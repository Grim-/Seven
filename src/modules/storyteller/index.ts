import { allRepos } from '../../engine/library/repos'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { ModuleFactory } from '../../engine/modules/sdk'
import { ToolError, str, type ToolDef } from '../../engine/tools/types'
import nexusHtml from './nexus.html?raw'

interface Repo {
  id: string
  tags: string[]
  scope: 'use' | 'run'
  values: string[]
}

interface Act {
  name: string
  story_beat: string
  transition_threshold: string
  branches: { content: string }[]
}

interface Template {
  id: string
  title?: string
  tags: string[]
  story_notes?: string
  callToActionOptions?: { content: string }[]
  acts?: Act[]
}

interface Fact {
  kind: string
  status: string
  summary: string
  knows: string[]
  turn: number
}

interface Story {
  id: string
  template_id: string
  status?: 'active' | 'paused' | 'completed' | 'abandoned'
  created_at: string
  current_act_index: number
  bindings: Record<string, string>
  turn: number
  facts: Record<string, Fact>
  current_cta: string
  current_branch: string
  branch_resolved?: boolean
  narrative_context: string
  closing_note?: string
  closed_at?: string
}

type Token = { repoId?: string; tag?: string; bindKey: string | null }

interface Choice {
  label: string
  to: string
}

interface Passage {
  id: string
  text: string
  choices: Choice[]
}

interface Tale {
  start: string
  passages: Passage[]
}

const ADJECTIVES = 'amber ashen bitter blazing brass broken cinder cobalt crimson cursed dusky ember fallen feral gilded glass gloom grim hollow iron ivory jade lantern lost lunar marble molten mossy nightfall obsidian pale quiet rust salt scarlet shadow silent silver smoke stone storm sullen thorn twilight velvet wild winter'.split(' ')
const NOUNS = 'abbey anvil arch beacon bramble cairn candle crown crypt dagger dune ember fang forge gate grove harbor hearth hollow keep lantern ledger loom marsh mill mire oath orchard quarry raven reach relic rookery sigil spire tarn thistle tide tomb tower vault veil warden well wharf wick'.split(' ')

function pick<T>(arr: T[]): T {
  return arr[crypto.randomInt(arr.length)]
}

function slug(value: string): string {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch {
    return null
  }
}

function jsonFiles(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : []
}

function out(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function cleanRepo(raw: unknown): Omit<Repo, 'id'> {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Partial<Repo>
  return {
    tags: (Array.isArray(d.tags) ? d.tags : []).map((t) => String(t).toLowerCase()),
    scope: d.scope === 'run' ? 'run' : 'use',
    values: (Array.isArray(d.values) ? d.values : []).map((v) => String(v)).filter(Boolean)
  }
}

function cleanTemplate(raw: unknown, title: string): Template {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Partial<Template>
  return {
    ...d,
    id: typeof d.id === 'string' && d.id.trim() ? d.id.trim() : title.trim(),
    title: typeof d.title === 'string' && d.title.trim() ? d.title : title.trim(),
    tags: (Array.isArray(d.tags) ? d.tags : []).map((t) => String(t).toLowerCase()),
    acts: Array.isArray(d.acts) ? d.acts : []
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function strings(value: unknown): string[] {
  return (Array.isArray(value) ? value : []).map(text).filter(Boolean)
}

function cleanTale(raw: unknown): Tale {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const passages = (Array.isArray(d.passages) ? d.passages : []).map((x) => {
    const p = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
    const choices = (Array.isArray(p.choices) ? p.choices : []).map((c) => {
      const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
      return { label: text(o.label), to: text(o.to) }
    })
    return { id: text(p.id), text: typeof p.text === 'string' ? p.text : '', choices: choices.filter((c) => c.label && c.to) }
  })
  return { start: text(d.start), passages: passages.filter((p) => p.id) }
}

function passagesFrom(value: unknown): Passage[] {
  if (!Array.isArray(value)) throw new ToolError('Give passages as a list, e.g. [{"id": "gate", "text": "...", "choices": [{"label": "Knock", "to": "hall"}]}].')
  const problems: string[] = []
  const out = value.map((x, i) => {
    const p = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
    const id = text(p.id)
    const body = typeof p.text === 'string' ? p.text.trim() : ''
    if (!id) problems.push(`passage ${i + 1} has no id`)
    if (!body) problems.push(`passage ${id || i + 1} has no text`)
    const choices = (Array.isArray(p.choices) ? p.choices : []).map((c, j) => {
      const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
      const label = text(o.label)
      const to = text(o.to)
      if (!label || !to) problems.push(`choice ${j + 1} of passage ${id || i + 1} needs a label and a to`)
      return { label, to }
    })
    return { id, text: body, choices }
  })
  const seen = new Set<string>()
  for (const p of out) {
    if (p.id && seen.has(p.id)) problems.push(`passage id ${p.id} is used twice`)
    seen.add(p.id)
  }
  if (problems.length) throw new ToolError(`Nothing was saved: ${problems.join('; ')}.`)
  return out
}

function taleReport(title: string, tale: Tale): string {
  const ids = new Set(tale.passages.map((p) => p.id))
  const missing = [...new Set(tale.passages.flatMap((p) => p.choices.map((c) => c.to)).filter((to) => !ids.has(to)))]
  const reached = new Set<string>()
  const queue = ids.has(tale.start) ? [tale.start] : []
  while (queue.length) {
    const id = queue.shift()!
    if (reached.has(id)) continue
    reached.add(id)
    for (const c of tale.passages.find((p) => p.id === id)?.choices ?? []) if (ids.has(c.to)) queue.push(c.to)
  }
  const unreachable = tale.passages.filter((p) => !reached.has(p.id)).map((p) => p.id)
  const endings = tale.passages.filter((p) => !p.choices.length).length
  return [
    `Branching story "${title}": ${tale.passages.length} passages, ${endings} ending${endings === 1 ? '' : 's'}, starts at ${tale.start || '(no start set)'}.`,
    ids.has(tale.start) ? '' : `The start passage ${tale.start || ''} isn't written yet.`,
    missing.length ? `Choices lead to passages not written yet: ${missing.join(', ')}. Add them with update_branching_story.` : '',
    unreachable.length ? `No choice leads to: ${unreachable.join(', ')}.` : ''
  ]
    .filter(Boolean)
    .join('\n')
}

function taleText(title: string, tale: Tale): string {
  return [taleReport(title, tale), ...tale.passages.map((p) => [`[${p.id}]${p.id === tale.start ? ' (start)' : ''}`, p.text, ...p.choices.map((c) => `-> ${c.label} [${c.to}]`), p.choices.length ? '' : '(ending)'].filter(Boolean).join('\n'))].join('\n\n')
}

interface ActInput {
  name: string
  beat: string
  threshold: string
  branches: string[]
}

function actsFrom(value: unknown): ActInput[] {
  if (!Array.isArray(value)) throw new ToolError('Give acts as a list, e.g. [{"name": "The Gate", "beat": "...", "threshold": "...", "branches": ["...", "..."]}].')
  const problems: string[] = []
  const acts = value.map((x, i) => {
    const a = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
    const act = { name: text(a.name), beat: text(a.beat), threshold: text(a.threshold), branches: strings(a.branches) }
    if (!act.name) problems.push(`act ${i + 1} has no name`)
    if (!act.beat) problems.push(`act ${act.name || i + 1} has no beat`)
    if (!act.threshold) problems.push(`act ${act.name || i + 1} has no threshold`)
    if (!act.branches.length) problems.push(`act ${act.name || i + 1} has no branches`)
    return act
  })
  if (problems.length) throw new ToolError(`Nothing was saved: ${problems.join('; ')}.`)
  return acts
}

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    private repos = new Map<string, Repo>()
    private templates = new Map<string, Template>()
    private pois = new Map<string, Record<string, unknown>>()

    async init(): Promise<void> {
      const dir = String(this.settings.libraryFolder ?? '').trim()
      if (!dir || !fs.existsSync(dir)) return
      for (const sub of ['templates', 'repos', 'pois']) fs.mkdirSync(path.join(dir, sub), { recursive: true })
      this.importRuns(dir)
    }

    private load(dir: string): void {
      for (const f of jsonFiles(path.join(dir, 'repos'))) {
        const d = readJson<Partial<Repo>>(path.join(dir, 'repos', f))
        if (d?.id) this.repos.set(d.id, { id: d.id, tags: (d.tags ?? []).map((t) => t.toLowerCase()), scope: d.scope === 'run' ? 'run' : 'use', values: d.values ?? [] })
      }
      for (const f of jsonFiles(path.join(dir, 'templates'))) {
        const d = readJson<Template>(path.join(dir, 'templates', f))
        if (d?.id) this.templates.set(d.id, { ...d, tags: (d.tags ?? []).map((t) => t.toLowerCase()) })
      }
      for (const f of jsonFiles(path.join(dir, 'pois'))) {
        const d = readJson<Record<string, unknown> & { id?: string; tags?: string[] }>(path.join(dir, 'pois', f))
        if (d?.id) this.pois.set(d.id, { ...d, tags: (d.tags ?? []).map((t) => t.toLowerCase()) })
      }
    }

    private loadPages(): void {
      for (const r of allRepos()) this.repos.set(r.title.trim(), { id: r.title.trim(), tags: r.tags, scope: r.scope, values: r.values })
      for (const { id } of this.pages.list('template')) {
        const page = this.pages.get(id)
        const d = cleanTemplate(page.data, page.title)
        this.templates.set(d.id, d)
      }
      for (const { id } of this.pages.list('poi')) {
        const page = this.pages.get(id)
        const d = (page.data && typeof page.data === 'object' ? page.data : {}) as Record<string, unknown> & { tags?: string[] }
        const key = typeof d.id === 'string' && d.id.trim() ? d.id.trim() : page.title.trim()
        this.pois.set(key, { ...d, id: key, tags: (Array.isArray(d.tags) ? d.tags : []).map((t) => String(t).toLowerCase()) })
      }
    }

    private ensureLoaded(): void {
      this.repos.clear()
      this.templates.clear()
      this.pois.clear()
      const dir = String(this.settings.libraryFolder ?? '').trim()
      if (dir && fs.existsSync(dir)) this.load(dir)
      this.loadPages()
    }

    async pageView(type: string, page: { id: string; title: string; data: unknown }): Promise<{ html: string; values: unknown }> {
      if (type === 'repo') return { html: nexusHtml, values: { mode: 'repo', id: page.title.trim(), title: page.title, data: cleanRepo(page.data) } }
      if (type === 'tale') return { html: nexusHtml, values: { mode: 'tale', title: page.title, data: cleanTale(page.data), json: JSON.stringify(cleanTale(page.data), null, 2) } }
      const data = type === 'template' ? cleanTemplate(page.data, page.title) : page.data && typeof page.data === 'object' ? page.data : { tags: [], description: '' }
      return { html: nexusHtml, values: { mode: type, title: page.title, json: JSON.stringify(data, null, 2) } }
    }

    async onPageAction(type: string, page: { title: string }, name: string, payload: unknown): Promise<{ message: string; data: unknown } | string | void> {
      if (name !== 'save') return
      const p = (payload ?? {}) as Record<string, unknown>
      if (type === 'repo') {
        const values = String(p.values ?? '').split(/\r?\n/).map((v) => v.trim()).filter(Boolean)
        const tags = String(p.tags ?? '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
        return { message: 'Saved.', data: { tags, scope: p.scope === 'run' ? 'run' : 'use', values } }
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(String(p.json ?? ''))
      } catch (err) {
        return `That isn't valid JSON: ${err instanceof Error ? err.message : String(err)}`
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'It needs to be a JSON object.'
      return { message: 'Saved.', data: type === 'template' ? cleanTemplate(parsed, page.title) : type === 'tale' ? cleanTale(parsed) : parsed }
    }

    pageRoll(type: string, page: { title: string; data: unknown }): string | null {
      if (type !== 'repo') return null
      const values = cleanRepo(page.data).values
      if (!values.length) throw new ToolError(`The repo "${page.title.trim()}" has no values yet. Add some values to it first, then roll it again.`)
      this.ensureLoaded()
      return this.compile(pick(values), {})
    }

    pageText(type: string, page: { title: string; data: unknown }): string {
      if (type === 'repo') {
        const d = cleanRepo(page.data)
        return `Repo "${page.title.trim()}" (${d.scope === 'run' ? 'rolled once per story run' : 'rolled each time'}${d.tags.length ? `; tags: ${d.tags.join(', ')}` : ''}). Values:\n${d.values.map((v) => `- ${v}`).join('\n') || '(none yet)'}`
      }
      if (type === 'template') {
        const t = cleanTemplate(page.data, page.title)
        return [`Story template "${t.title ?? t.id}" (id ${t.id})${t.tags.length ? `, tags: ${t.tags.join(', ')}` : ''}`, t.story_notes ?? '', ...(t.acts ?? []).map((a, i) => `Act ${i + 1}: ${a.name}. ${a.story_beat}`)].filter(Boolean).join('\n')
      }
      if (type === 'tale') return taleText(page.title, cleanTale(page.data))
      return JSON.stringify(page.data ?? {}, null, 2)
    }

    private importRuns(dir: string): void {
      for (const f of jsonFiles(path.join(dir, 'stories'))) {
        const story = readJson<Story>(path.join(dir, 'stories', f))
        if (!story?.id) continue
        const name = `stories/${slug(story.id)}.json`
        if (this.files.exists(name)) continue
        this.files.writeText(name, JSON.stringify(story, null, 2))
      }
    }

    private storyName(id: string): string {
      const s = slug(id)
      if (!s) throw new ToolError(`"${id}" is not a story id. Call list_stories to see the story ids, e.g. ember-forge.`)
      return `stories/${s}.json`
    }

    private loadStory(id: string): Story {
      const name = this.storyName(id)
      if (!this.files.exists(name)) throw new ToolError(`There is no story "${id}". Use list_stories to see them.`)
      return JSON.parse(this.files.readText(name)) as Story
    }

    private saveStory(story: Story): void {
      this.files.writeText(this.storyName(story.id), JSON.stringify(story, null, 2))
    }

    private newId(): string {
      for (let i = 0; i < 40; i++) {
        const id = `${pick(ADJECTIVES)}-${pick(NOUNS)}`
        if (!this.files.exists(`stories/${id}.json`)) return id
      }
      for (let i = 0; i < 40; i++) {
        const id = `${pick(ADJECTIVES)}-${pick(NOUNS)}-${String(crypto.randomInt(100)).padStart(2, '0')}`
        if (!this.files.exists(`stories/${id}.json`)) return id
      }
      return `story-${crypto.randomBytes(4).toString('hex')}`
    }

    private token(key: string): Token {
      const [base, bind] = key.split('#')
      if (base.startsWith('tag:')) return { tag: base.slice(4).toLowerCase(), bindKey: bind || null }
      return { repoId: base, bindKey: bind || null }
    }

    private roll(t: Token): string | null {
      if (t.repoId) {
        const repo = this.repos.get(t.repoId)
        return repo && repo.values.length ? pick(repo.values) : null
      }
      const matching = [...this.repos.values()].filter((r) => r.tags.includes(t.tag!) && r.values.length)
      return matching.length ? pick(pick(matching).values) : null
    }

    private compile(text: string | undefined, bindings: Record<string, string>, maxDepth = 10): string {
      if (!text) return ''
      let compiled = text
      let depth = 0
      while (depth < maxDepth) {
        const previous = compiled
        compiled = compiled.replace(/\{([^}]+)\}/g, (match, key: string) => {
          const t = this.token(key)
          let bindKey = t.bindKey
          if (!bindKey && t.repoId && this.repos.get(t.repoId)?.scope === 'run') bindKey = t.repoId
          if (bindKey && Object.prototype.hasOwnProperty.call(bindings, bindKey)) return bindings[bindKey]
          const rolled = this.roll(t)
          if (rolled === null) return match
          if (bindKey) {
            const resolved = this.compile(rolled, bindings, maxDepth - depth)
            bindings[bindKey] = resolved
            return resolved
          }
          return rolled
        })
        if (compiled === previous) break
        depth++
      }
      if (depth === maxDepth) this.log.warn(`Storyteller: hit the depth limit compiling "${text.slice(0, 80)}" (repos may reference each other in a loop)`)
      return compiled
    }

    private template(id: string): Template {
      const t = this.templates.get(id)
      if (!t) throw new ToolError(`There is no template "${id}". Templates: ${[...this.templates.keys()].join(', ') || 'none yet; the user can add one in Data under Story templates'}.`)
      return t
    }

    private active(story: Story): void {
      if (story.status && story.status !== 'active') throw new ToolError(`Story "${story.id}" is ${story.status}.${story.status === 'paused' ? ' Use resume_story first.' : ' It cannot go on; start_story starts a new one.'}`)
    }

    private scenario(story: Story): string {
      if (!story.current_branch) return ''
      return story.branch_resolved ? `(Resolved; work toward the transition threshold instead.) ${story.current_branch}` : story.current_branch
    }

    private templatePage(ref: string): { id: string; title: string; template: Template } {
      const want = ref.trim().toLowerCase()
      for (const { id, title } of this.pages.list('template')) {
        const template = cleanTemplate(this.pages.get(id).data, title)
        if (template.id.toLowerCase() === want || title.trim().toLowerCase() === want) return { id, title, template }
      }
      throw new ToolError(`There is no story template "${ref}". Templates: ${this.pages.list('template').map((t) => t.title).join(', ') || 'none yet'}.`)
    }

    private unknownTokens(template: Template): string[] {
      const texts = [template.story_notes ?? '', ...(template.callToActionOptions ?? []).map((c) => c.content), ...(template.acts ?? []).flatMap((a) => [a.story_beat, a.transition_threshold, ...a.branches.map((b) => b.content)])]
      const keys = new Set(texts.flatMap((t) => [...t.matchAll(/\{([^}]+)\}/g)].map((m) => m[1])))
      return [...keys].filter((key) => {
        const t = this.token(key)
        return t.repoId ? !this.repos.has(t.repoId) : ![...this.repos.values()].some((r) => r.tags.includes(t.tag!))
      })
    }

    private templateReport(template: Template): string {
      const acts = template.acts ?? []
      const unknown = this.unknownTokens(template)
      return [
        `Story template "${template.title ?? template.id}" (id ${template.id}): ${acts.length} act${acts.length === 1 ? '' : 's'}, ${acts.reduce((n, a) => n + a.branches.length, 0)} branches, ${(template.callToActionOptions ?? []).length} calls to action. Start a run with start_story template_id=${template.id}.`,
        unknown.length ? `It rolls from repos that don't exist yet: ${unknown.map((k) => `{${k}}`).join(', ')}. Make them with repo_write, or the braces stay in the text.` : ''
      ]
        .filter(Boolean)
        .join('\n')
    }

    private templateData(base: Template, p: Record<string, unknown>): Template {
      const next: Template = { ...base }
      if (p.title !== undefined && p.title !== null) next.title = text(p.title) || base.title
      if (p.tags !== undefined && p.tags !== null) next.tags = strings(p.tags).map((t) => t.toLowerCase())
      if (p.story_notes !== undefined && p.story_notes !== null) next.story_notes = text(p.story_notes)
      if (p.calls_to_action !== undefined && p.calls_to_action !== null) next.callToActionOptions = strings(p.calls_to_action).map((content) => ({ content }))
      if (p.acts !== undefined && p.acts !== null) next.acts = actsFrom(p.acts).map((a) => ({ name: a.name, story_beat: a.beat, transition_threshold: a.threshold, branches: a.branches.map((content) => ({ content })) }))
      return next
    }

    define(tools: { add(tool: ToolDef): void }): void {
      const add = (name: string, description: string, properties: Record<string, unknown>, run: (p: Record<string, unknown>) => unknown) =>
        tools.add({
          name,
          group: 'storyteller',
          needsWorkspace: false,
          description,
          params: { type: 'object', properties } as ToolDef['params'],
          execute: async (params) => {
            this.ensureLoaded()
            return out(await run(params))
          }
        })

      add('list_stories', 'List story runs (id, template, status, act, turn) and the templates you can start.', { status: { enum: ['all', 'active', 'paused', 'completed', 'abandoned'], description: 'Which runs to list' } }, (p) => {
        const want = typeof p.status === 'string' ? p.status : 'all'
        const dir = path.join(this.dataDir, 'stories')
        const runs = (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : [])
          .map((f) => JSON.parse(this.files.readText(`stories/${f}`)) as Story)
          .filter((s) => want === 'all' || (s.status ?? 'active') === want)
          .sort((a, b) => (b.closed_at ?? b.created_at).localeCompare(a.closed_at ?? a.created_at))
        const lines = runs.map((s) => {
          const t = this.templates.get(s.template_id)
          const act = t?.acts?.[s.current_act_index]?.name ?? 'sandbox'
          return `- ${s.id}: ${t?.title ?? s.template_id}, ${s.status ?? 'active'}, ${act}, turn ${s.turn ?? 0}${s.closing_note ? ` (note: ${s.closing_note.slice(0, 80)})` : ''}`
        })
        const templates = [...this.templates.values()].map((t) => `- ${t.id}${t.title ? `: ${t.title}` : ''}`)
        return `Stories:\n${lines.join('\n') || '(none)'}\n\nTemplates:\n${templates.join('\n') || '(none)'}`
      })

      add('start_story', 'Start a new branching story from a template.', { template_id: { type: 'string', description: 'Template id, e.g. emberdark' } }, (p) => {
        const template = this.template(str(p, 'template_id'))
        const bindings: Record<string, string> = {}
        const cta = template.callToActionOptions?.length ? pick(template.callToActionOptions) : null
        const first = template.acts?.[0]
        const story: Story = {
          id: this.newId(),
          template_id: template.id,
          status: 'active',
          created_at: new Date().toISOString(),
          current_act_index: 0,
          bindings,
          turn: 0,
          facts: {},
          current_cta: this.compile(cta?.content, bindings),
          current_branch: first?.branches?.length ? this.compile(pick(first.branches).content, bindings) : '',
          branch_resolved: false,
          narrative_context: 'The story has just begun.'
        }
        const rules = this.compile(template.story_notes, bindings)
        const directive = first ? `ACT 1 BEAT: ${this.compile(first.story_beat, bindings)}\n\nACT 1 SCENARIO: ${story.current_branch}` : 'Sandbox mode: no structured beats.'
        this.saveStory(story)
        return { story_id: story.id, global_story_rules: rules, setup_directive: `STARTING HOOK: ${story.current_cta}\n\n${directive}` }
      })

      add('load_story_context', "Load a story's running narrative, facts and the current act's goals.", { story_id: { type: 'string' } }, (p) => {
        const story = this.loadStory(str(p, 'story_id'))
        this.active(story)
        story.bindings ??= {}
        const before = JSON.stringify(story.bindings)
        const template = this.template(story.template_id)
        const act = template.acts?.[story.current_act_index]
        const rules = this.compile(template.story_notes, story.bindings)
        const payload = act
          ? {
              story_id: story.id,
              running_narrative: story.narrative_context,
              facts: story.facts ?? {},
              global_story_rules: rules,
              act_name: act.name,
              act_theme: this.compile(act.story_beat, story.bindings),
              active_scenario: this.scenario(story),
              transition_threshold: `When this happens, call checkpoint_story with threshold_met=true: ${this.compile(act.transition_threshold, story.bindings)}`
            }
          : { story_id: story.id, running_narrative: story.narrative_context, facts: story.facts ?? {}, global_story_rules: rules, current_directive: 'The structured acts are complete. Continue in sandbox mode.' }
        if (JSON.stringify(story.bindings) !== before) this.saveStory(story)
        return payload
      })

      add(
        'checkpoint_story',
        'Save what just happened. Mark the act scenario resolved, or advance to the next act when its threshold is met.',
        {
          story_id: { type: 'string' },
          narrative_update: { type: 'string', description: 'A rich prose summary of what just happened, appended to the running narrative' },
          scenario_resolved: { type: ['boolean', 'null'], description: "true once the current act's scenario has been dealt with" },
          threshold_met: { type: 'boolean', description: "true ONLY if the current act's transition threshold has definitely been reached; this cannot be undone" }
        },
        (p) => {
          const story = this.loadStory(str(p, 'story_id'))
          this.active(story)
          story.bindings ??= {}
          story.turn = (story.turn ?? 0) + 1
          story.narrative_context += `\n- ${str(p, 'narrative_update')}`
          let message = 'Saved.'
          if (p.scenario_resolved === true && story.current_branch && !story.branch_resolved) {
            story.branch_resolved = true
            message += ' Scenario marked resolved.'
          }
          if (p.threshold_met === true) {
            const template = this.template(story.template_id)
            story.current_act_index += 1
            const next = template.acts?.[story.current_act_index]
            story.branch_resolved = false
            if (next) {
              story.current_branch = next.branches?.length ? this.compile(pick(next.branches).content, story.bindings) : ''
              message += ` Advanced to ${next.name}. Use load_story_context for the new scenario and theme.`
            } else {
              story.current_branch = ''
              message += ' All structured acts are done; continue in sandbox mode.'
            }
          }
          this.saveStory(story)
          return message
        }
      )

      add(
        'record_facts',
        'Record what is currently true in the story world. Reusing a key overwrites it; retire keys instead of deleting them.',
        {
          story_id: { type: 'string' },
          upserts: {
            type: ['array', 'null'],
            items: {
              type: 'object',
              properties: {
                key: { type: 'string', description: 'Stable kind-prefixed key, e.g. npc:baker' },
                kind: { enum: ['npc', 'item', 'place', 'flag'] },
                status: { type: ['string', 'null'], description: 'e.g. alive, dead, held, lost; null keeps the previous status' },
                summary: { type: 'string' },
                knows: { type: ['array', 'null'], items: { type: 'string' }, description: 'Fact keys this NPC is aware of' }
              }
            }
          },
          retire: { type: ['array', 'null'], items: { type: 'string' }, description: 'Keys to mark retired' }
        },
        (p) => {
          const story = this.loadStory(str(p, 'story_id'))
          this.active(story)
          story.facts ??= {}
          story.turn = (story.turn ?? 0) + 1
          const upserts = Array.isArray(p.upserts) ? (p.upserts as Record<string, unknown>[]) : []
          const retire = Array.isArray(p.retire) ? (p.retire as unknown[]).filter((k): k is string => typeof k === 'string') : []
          for (const e of upserts) {
            if (typeof e?.key !== 'string' || !e.key.trim()) continue
            const prior = story.facts[e.key]
            story.facts[e.key] = {
              kind: typeof e.kind === 'string' ? e.kind : (prior?.kind ?? 'flag'),
              status: typeof e.status === 'string' && e.status ? e.status : (prior?.status ?? 'active'),
              summary: typeof e.summary === 'string' ? e.summary : (prior?.summary ?? ''),
              knows: [...new Set([...(prior?.knows ?? []), ...(Array.isArray(e.knows) ? (e.knows as unknown[]).filter((k): k is string => typeof k === 'string') : [])])],
              turn: story.turn
            }
          }
          for (const key of retire) if (story.facts[key]) story.facts[key].status = 'retired'
          this.saveStory(story)
          return `${upserts.length} fact(s) recorded, ${retire.length} retired.`
        }
      )

      add(
        'close_story',
        'Pause, complete or abandon a story run.',
        {
          story_id: { type: 'string' },
          status: { enum: ['paused', 'completed', 'abandoned'] },
          closing_note: { type: 'string', description: 'For a pause: where things stand and what was about to happen. For a completion: how it ended.' }
        },
        (p) => {
          const story = this.loadStory(str(p, 'story_id'))
          if (story.status && story.status !== 'active') throw new ToolError(`Story "${story.id}" is already ${story.status}, so there is nothing to close.`)
          const status = p.status === 'completed' || p.status === 'abandoned' ? p.status : 'paused'
          const note = str(p, 'closing_note')
          story.status = status
          story.closing_note = note
          story.closed_at = new Date().toISOString()
          story.narrative_context += `\n- [${status.toUpperCase()}] ${note}`
          this.saveStory(story)
          return status === 'paused' ? `Story "${story.id}" paused. Resume it with resume_story.` : `Story "${story.id}" marked ${status}.`
        }
      )

      add('resume_story', 'Reopen a paused story and get a recap of where it left off.', { story_id: { type: 'string' } }, (p) => {
        const story = this.loadStory(str(p, 'story_id'))
        if (story.status === 'completed' || story.status === 'abandoned') throw new ToolError(`Story "${story.id}" was ${story.status} and can't be resumed. Start a new one with start_story.`)
        const recap = story.closing_note || 'No pause note was recorded.'
        story.status = 'active'
        story.bindings ??= {}
        delete story.closing_note
        delete story.closed_at
        const template = this.template(story.template_id)
        const act = template.acts?.[story.current_act_index]
        this.saveStory(story)
        return {
          story_id: story.id,
          recap,
          running_narrative: story.narrative_context,
          facts: story.facts ?? {},
          global_story_rules: this.compile(template.story_notes, story.bindings),
          act_name: act ? act.name : 'Sandbox',
          active_scenario: this.scenario(story),
          directive: 'Open with a short "Last we left off..." passage drawn from the recap before continuing play.'
        }
      })

      add(
        'add_story_template',
        'Write a new story template: its rules, opening hooks and every act with its branches. {repo name} or {tag:name} in any text rolls from your repos when a run starts.',
        {
            title: { type: 'string', description: 'The story name' },
            tags: { type: ['array', 'null'], items: { type: 'string' } },
            story_notes: { type: ['string', 'null'], description: 'Rules for the whole story: tone, setting, what the storyteller must keep to' },
            calls_to_action: { type: ['array', 'null'], items: { type: 'string' }, description: 'Opening hooks; one is picked at random when a run starts' },
            acts: {
              type: ['array', 'null'],
              description: 'In order. Each act: name, beat (what the act is about), threshold (what must happen to move on), branches (scenarios, one picked at random)',
              items: { type: 'object', properties: { name: { type: 'string' }, beat: { type: 'string' }, threshold: { type: 'string' }, branches: { type: 'array', items: { type: 'string' } } } }
            }
          },
        (p) => {
          const title = str(p, 'title')
          if (this.pages.list('template').some((t) => t.title.trim().toLowerCase() === title.toLowerCase())) throw new ToolError(`There is already a story template "${title}". Change it with update_story_template.`)
          const template = this.templateData(cleanTemplate({}, title), { ...p, acts: p.acts ?? [] })
          if (!template.acts?.length) throw new ToolError('Give at least one act.')
          this.pages.create('template', title, template)
          this.ensureLoaded()
          return this.templateReport(template)
        }
      )

      add(
        'update_story_template',
        'Change a story template. Only what you give is replaced; acts replaces all the acts.',
        { template: { type: 'string', description: 'Template id or title' }, ...{
            title: { type: 'string', description: 'The story name' },
            tags: { type: ['array', 'null'], items: { type: 'string' } },
            story_notes: { type: ['string', 'null'], description: 'Rules for the whole story: tone, setting, what the storyteller must keep to' },
            calls_to_action: { type: ['array', 'null'], items: { type: 'string' }, description: 'Opening hooks; one is picked at random when a run starts' },
            acts: {
              type: ['array', 'null'],
              description: 'In order. Each act: name, beat (what the act is about), threshold (what must happen to move on), branches (scenarios, one picked at random)',
              items: { type: 'object', properties: { name: { type: 'string' }, beat: { type: 'string' }, threshold: { type: 'string' }, branches: { type: 'array', items: { type: 'string' } } } }
            }
          } },
        (p) => {
          const found = this.templatePage(str(p, 'template'))
          const template = this.templateData(found.template, p)
          this.pages.save(found.id, template)
          this.ensureLoaded()
          return this.templateReport(template)
        }
      )

      add(
        'add_branching_story',
        'Write a finished branching story: passages of prose where choices lead to other passages. Long stories can be written in parts; add the rest with update_branching_story.',
        {
          title: { type: 'string' },
          start: { type: 'string', description: 'The id of the first passage' },
          passages: {
              type: 'array',
              description: 'Each passage: id (short, unique), text (the prose), choices (label shown to the reader, to = the id of the passage it leads to; none means an ending)',
              items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' }, choices: { type: ['array', 'null'], items: { type: 'object', properties: { label: { type: 'string' }, to: { type: 'string' } } } } } }
            }
        },
        (p) => {
          const title = str(p, 'title')
          if (this.pages.find('tale', title)) throw new ToolError(`There is already a branching story "${title}". Add to it with update_branching_story.`)
          const tale: Tale = { start: str(p, 'start'), passages: passagesFrom(p.passages) }
          this.pages.create('tale', title, tale)
          return taleReport(title, tale)
        }
      )

      add(
        'update_branching_story',
        'Add or rewrite passages of a branching story (a passage with an existing id is replaced), remove passages, or change where it starts.',
        {
          branching_story: { type: 'string', description: 'Its title' },
          start: { type: ['string', 'null'], description: 'A new first passage id' },
          passages: { ...{
              type: 'array',
              description: 'Each passage: id (short, unique), text (the prose), choices (label shown to the reader, to = the id of the passage it leads to; none means an ending)',
              items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' }, choices: { type: ['array', 'null'], items: { type: 'object', properties: { label: { type: 'string' }, to: { type: 'string' } } } } } }
            }, type: ['array', 'null'] },
          remove_passages: { type: ['array', 'null'], items: { type: 'string' }, description: 'Ids of passages to remove' }
        },
        (p) => {
          const ref = str(p, 'branching_story')
          const page = this.pages.find('tale', ref)
          if (!page) throw new ToolError(`There is no branching story "${ref}". Branching stories: ${this.pages.list('tale').map((t) => t.title).join(', ') || 'none yet'}.`)
          const tale = cleanTale(page.data)
          const added = p.passages === undefined || p.passages === null ? [] : passagesFrom(p.passages)
          const removed = new Set(strings(p.remove_passages))
          const unknown = [...removed].filter((id) => !tale.passages.some((x) => x.id === id))
          if (unknown.length) throw new ToolError(`Nothing was saved: there is no passage ${unknown.join(', ')}.`)
          const byId = new Map(tale.passages.filter((x) => !removed.has(x.id)).map((x) => [x.id, x]))
          for (const x of added) byId.set(x.id, x)
          const next: Tale = { start: text(p.start) || tale.start, passages: [...byId.values()] }
          this.pages.save(page.id, next)
          return taleReport(page.title, next)
        }
      )

    }
  }

export default factory
