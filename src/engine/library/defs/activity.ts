import fs from 'node:fs'
import { notFound } from '@shared/errors'
import { ROUTINE_REPEATS, type Routine } from '@shared/routines'
import { linkFor, splitLink } from '@shared/text'
import type { Theme } from '@shared/theme'
import { dayKey, type TimelineEvent, type TimelineRow } from '@shared/timeline'
import type { ChatMessage, ReminderRepeat, WebLogEntry } from '@shared/types'
import { agentAccess } from '../../agents/access'
import { board } from '../../board/store'
import { data } from '../../data/hub'
import { modules } from '../../modules/registry'
import { scripts } from '../../python/scripts'
import { reminders } from '../../reminders/store'
import { routines } from '../../routines/store'
import { sessionAccess } from '../../sessions/access'
import { storyRuns, type StoryRun } from '../../stories'
import { themes } from '../../themes/store'
import { timeline } from '../../timeline/store'
import { ToolError } from '../../tools/types'
import { readLines } from '../../util/fs'
import { noteFailure } from '../../util/report'
import { WEB_LOG } from '../../weblog'
import { chatExport } from '../exporters'
import { storePacking } from '../packing'
import { ENTRY_WIDGET, kindRt } from './runtime'
import { accessOf, has, USER, withJson, type Kind, type KindContext, type KindHit } from './types'

const reminderLine = (r: { enabled: boolean; next: number }) => `${r.enabled ? 'next' : 'paused, was'} ${new Date(r.next).toLocaleString()}`

export const reminderKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Yours',
  kind: 'reminder',
  pack(id) {
    const r = reminders.list().find((x) => x.id === id)
    if (!r) return undefined
    return { agentId: r.agentId, kind: r.kind, text: r.text, repeat: r.repeat, at: r.next }
  },
  uses(id) {
    const r = reminders.list().find((x) => x.id === id)
    return r?.agentId ? [{ kind: 'agent', id: r.agentId }] : []
  },
  unpack(value, how) {
    const raw = (value && typeof value === 'object' ? value : {}) as {
      agentId?: string
      kind?: 'remind' | 'run'
      text?: string
      repeat?: ReminderRepeat
      at?: number
    }
    const agentId = raw.agentId ? how.entry(raw.agentId, 'agent') : (agentAccess.list()[0]?.id ?? '')
    return reminders.add({
      agentId,
      sessionId: null,
      kind: raw.kind === 'run' ? 'run' : 'remind',
      text: typeof raw.text === 'string' && raw.text.trim() ? raw.text.trim() : 'Reminder',
      repeat: raw.repeat ?? 'none',
      at: typeof raw.at === 'number' && Number.isFinite(raw.at) ? raw.at : Date.now() + 3600_000
    }).id
  },
  remove: (id) => void reminders.cancel(id),
  label: 'Reminder',
  textParts: ['summary'],
  plural: 'Reminders',
  exportable: true,
  export(id) {
    return withJson(this, id, reminders.list().find((r) => r.id === id))
  },
  icon: 'alarm-clock',
  description: 'timed reminders and scheduled runs',
  parts: ['summary'],
  actions: ['set_reminder', 'cancel_reminder', 'list_reminders'],
  title: (id) => reminders.list().find((r) => r.id === id)?.text.slice(0, 60) ?? id,
  available: () => true,
  search(query, limit) {
    const q = query.toLowerCase()
    return reminders
      .list()
      .filter((r) => !q || has(r.text, q))
      .slice(0, limit)
      .map((r) => ({ kind: 'reminder', id: r.id, title: r.text.slice(0, 60), at: r.next }))
  },
  line: (id) => {
    const r = reminders.list().find((x) => x.id === id)
    return r ? reminderLine(r) : ''
  },
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  resolve: (ref) => reminders.list().find((r) => r.id === ref)?.id ?? null,
  full(id) {
    const r = reminders.list().find((x) => x.id === id)
    if (!r) throw new ToolError(`No reminder ${id}`)
    return `Reminder: ${r.text}. ${r.enabled ? 'Next' : 'Paused; was due'} ${new Date(r.next).toLocaleString()}, repeats ${JSON.stringify(r.repeat)}.`
  }
}

const themeSummary = (t: Theme) => t.description || themeLine(t)

function themeLine(t: Theme): string {
  const bits = [`colours ${t.accent} / ${t.secondary} on ${t.base}`, t.sky !== 'off' ? `sky ${t.sky}` : '', t.light ? `mood light ${t.light.color}` : '', t.backdrop ? 'background' : '', t.effect !== 'none' ? `${t.effect} effect` : '', t.music.length ? `${t.music.length} music tracks` : '']
  return bits.filter(Boolean).join(', ')
}

export const themeKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  ...storePacking({ find: (id) => themes.find(id), names: () => themes.list().map((t) => t.name), save: (x) => themes.save(x), everywhere: (t) => Boolean(t.builtin), drop: ['builtin'] }),
  group: 'Tools',
  kind: 'theme',
  rename: (id, name) => void themes.save({ id, name }),
  remove: (id) => themes.delete(id),
  label: 'Theme',
  plural: 'Themes',
  exportable: true,
  export(id) {
    const { id: _id, builtin: _b, createdBy: _c, ...rest } = themes.get(id)
    return withJson(this, id, rest)
  },
  icon: 'palette',
  description: "the app's looks and moods: colours, sky, mood light, background, music and sounds",
  parts: [],
  actions: ['theme_save', 'ambience', 'cue'],
  available: () => true,
  title: (id) => themes.find(id)?.name ?? id,
  search(query, limit) {
    const q = query.toLowerCase()
    return themes
      .list()
      .filter((t) => !q || has(t.name, q) || has(t.description, q))
      .slice(0, limit)
      .map((t) => ({ kind: 'theme', id: t.id, title: t.name, at: t.updatedAt || undefined }))
  },
  line: (id) => {
    const t = themes.find(id)
    return t ? themeSummary(t) : ''
  },
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  resolve: (ref) => themes.find(ref)?.id ?? null,
  full(id) {
    const t = themes.get(id)
    const file = (a: string | null) => (a && data.assets.exists(a) ? data.assets.get(a).name : null)
    const sounds = Object.entries(t.sounds).filter(([, v]) => v).map(([k, v]) => `${k}: ${file(v)}`)
    return [
      `# ${t.name}${t.builtin ? ' (built in, read only)' : ''}`,
      t.description,
      `Colours: accent ${t.accent}, soft ${t.accentSoft}, secondary ${t.secondary}, base ${t.base}. Sky: ${t.sky}. Mood light: ${t.light ? `${t.light.color} at ${t.light.strength}` : 'none'}. Effect: ${t.effect}.`,
      t.backdrop ? `Background: ${[t.backdrop.colors.join(' → '), file(t.backdrop.image)].filter(Boolean).join(' with ')}, dim ${t.backdrop.dim}.` : 'No background picture.',
      `Music: ${t.music.length ? t.music.map((m) => file(m) ?? m).join(', ') : 'none'} (volume ${t.volume}). Sounds: ${sounds.length ? sounds.join(', ') : 'none'}.`
    ].filter(Boolean).join('\n')
  }
}

function visibleChats(ctx: KindContext) {
  const access = accessOf(ctx)
  if (access.chats === 'none') return []
  const agents = new Set(agentAccess.list().map((a) => a.id))
  return sessionAccess.list().filter((s) => agents.has(s.agentId) && (access.chats === 'all' || s.agentId === ctx.agentId))
}

function messageText(m: ChatMessage): string {
  return m.parts
    .map((p) => (p.type === 'text' ? p.text : p.type === 'tool' ? `[${p.name}]` : ''))
    .filter(Boolean)
    .join('\n')
    .trim()
}

export const chatKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Agents',
  kind: 'chat',
  portability: { canExport: true, canImport: false },
  rename: (id, name) => sessionAccess.rename(id, name),
  remove: (id) => sessionAccess.remove(id),
  label: 'Chat',
  plural: 'Chats',
  exportable: true,
  export: (id) => chatExport(id),
  icon: 'message-square',
  description: 'past conversations; link one as #user or #agent for just that side',
  parts: [],
  linkParts: [
    { name: 'user', description: "only the user's messages" },
    { name: 'agent', description: "only the agent's replies" }
  ],
  actions: [],
  available: (ctx) => accessOf(ctx).chats !== 'none',
  title: (id) => sessionAccess.list().find((s) => s.id === id)?.title ?? id,
  search(query, limit, ctx) {
    const q = query.toLowerCase()
    const out: KindHit[] = []
    for (const s of visibleChats(ctx)) {
      if (q && !has(s.title, q) && !sessionAccess.messages(s.id).some((m) => has(messageText(m), q))) continue
      out.push({ kind: 'chat', id: s.id, title: s.title, at: s.updatedAt })
      if (out.length >= limit) break
    }
    return out
  },
  resolve: (ref, ctx) => visibleChats(ctx).find((s) => s.id === ref || s.title.toLowerCase() === ref.trim().toLowerCase())?.id ?? null,
  line: (id, ctx) => {
    const s = visibleChats(ctx).find((x) => x.id === id)
    return s ? (agentAccess.get(s.agentId)?.name ?? s.agentId) : ''
  },
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  full(id, options, ctx) {
    const s = visibleChats(ctx).find((x) => x.id === id)
    if (!s) throw new ToolError(`No chat ${id}`)
    const name = agentAccess.get(s.agentId)?.name ?? 'Agent'
    const side = options.part === 'user' ? 'user' : options.part === 'agent' ? 'assistant' : null
    const lines = sessionAccess
      .messages(id)
      .filter((m) => !side || m.role === side)
      .map((m) => ({ m, text: messageText(m) }))
      .filter(({ text }) => text)
      .map(({ m, text }) => `**${m.role === 'user' ? 'User' : name}** (${new Date(m.createdAt).toLocaleString()}):\n${text}`)
    const tail = lines.join('\n\n')
    const only = side === 'user' ? " Only the user's messages." : side ? ` Only ${name}'s replies.` : ''
    return `# ${s.title}\nWith ${name}, ${new Date(s.createdAt).toLocaleDateString()} to ${new Date(s.updatedAt).toLocaleDateString()}.${only}\n\n${tail || '(no messages)'}`
  }
}

function stories(): StoryRun[] {
  return storyRuns.list()
}

const storyLine = (r: StoryRun) => `${r.template_id}, ${r.status ?? 'active'}, act ${r.current_act_index + 1}, turn ${r.turn}`

export const storyKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Worlds',
  kind: 'story',
  portability: { canExport: true, canImport: false },
  remove: (id) => storyRuns.delete(id),
  label: 'Story',
  textParts: ['summary'],
  plural: 'Stories',
  exportable: true,
  export(id) {
    return withJson(this, id, storyRuns.get(id))
  },
  icon: 'book-open',
  description: 'Storyteller runs: branching stories with acts, what is true in them, and where they stand',
  parts: ['summary'],
  actions: ['list_stories', 'start_story', 'load_story_context', 'checkpoint_story', 'record_facts', 'close_story', 'resume_story'],
  available: () => modules.list().some((m) => m.id === 'storyteller' && m.state === 'on'),
  title: (id) => id,
  search(query, limit) {
    const q = query.toLowerCase()
    return stories()
      .filter((r) => !q || has(r.id, q) || has(r.template_id, q) || has(r.narrative_context ?? '', q))
      .slice(0, limit)
      .map((r) => ({ kind: 'story', id: r.id, title: r.id, at: r.at }))
  },
  line: (id) => {
    const r = stories().find((x) => x.id === id)
    return r ? storyLine(r) : ''
  },
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  resolve: (ref) => stories().find((r) => r.id === ref || r.id.toLowerCase() === ref.toLowerCase())?.id ?? null,
  full(id) {
    const r = stories().find((x) => x.id === id)
    if (!r) throw new ToolError(`No story ${id}`)
    const facts = Object.entries(r.facts ?? {})
      .slice(0, 20)
      .map(([k, f]) => `- ${k} (${f.kind}, ${f.status}): ${f.summary}`)
    return `Story ${r.id} from ${r.template_id}: ${r.status ?? 'active'}, act ${r.current_act_index + 1}, turn ${r.turn}.\nNow: ${r.narrative_context || r.current_cta || 'not set'}${r.closing_note ? `\nClosing note: ${r.closing_note}` : ''}${facts.length ? `\nWhat's true:\n${facts.join('\n')}` : ''}`
  }
}

const scriptLine = (x: { description: string; code: string }) => x.description || `${x.code.split('\n').length} lines`

export const scriptKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  ...storePacking({ find: (id) => scripts.find(id), names: () => scripts.list().map((s) => s.name), save: (x) => scripts.save(x as unknown as Parameters<typeof scripts.save>[0]), drop: ['runs'] }),
  group: 'Yours',
  kind: 'script',
  rename(id, name) {
    const s = scripts.find(id)
    if (!s) throw new ToolError(`No script ${id}`)
    scripts.save({ id: s.id, name, code: s.code, description: s.description })
  },
  remove: (id) => scripts.delete(id),
  label: 'Python script',
  plural: 'Python',
  exportable: true,
  export(id) {
    const x = scripts.get(id)
    return { title: x.name, markdown: `# ${x.name}\n\n${x.description ? `${x.description}\n\n` : ''}\`\`\`python\n${x.code}\n\`\`\``, json: { name: x.name, description: x.description, code: x.code } }
  },
  icon: 'code',
  description: 'saved Python scripts and their last runs',
  parts: ['code', 'output'],
  actions: ['run_python', 'python_save'],
  available: () => modules.list().some((m) => m.id === 'python' && m.state === 'on'),
  title: (id) => scripts.find(id)?.name ?? id,
  search(query, limit) {
    const q = query.toLowerCase()
    return scripts
      .list()
      .filter((x) => !q || has(x.name, q) || has(x.description, q) || has(x.code, q))
      .slice(0, limit)
      .map((x) => ({ kind: 'script', id: x.id, title: x.name, at: Math.max(x.updatedAt, x.runs[0]?.at ?? 0) }))
  },
  resolve: (ref) => scripts.find(ref)?.id ?? null,
  line: (id) => {
    const x = scripts.find(id)
    return x ? scriptLine(x) : ''
  },
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  full(id) {
    const x = scripts.get(id)
    const last = x.runs[0]
    return `Script ${x.name}${x.description ? `: ${x.description}` : ''}\n\`\`\`python\n${x.code}\n\`\`\`${last ? `\nLast run ${new Date(last.at).toLocaleString()}, exit ${last.exit ?? 'none'}:\n${last.output.slice(0, 1500) || '(no output)'}` : '\nNot run yet.'}`
  }
}

export const messageKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Tools',
  kind: 'message',
  portability: { canExport: true, canImport: false },
  label: 'Message',
  plural: 'Message board',
  textParts: ['summary'],
  exportable: true,
  icon: 'messages-square',
  description: 'the board every agent shares across chats: messages agents left for each other',
  parts: ['summary'],
  actions: ['add_message', 'read_messages'],
  available: () => true,
  title: (id) => board.list().find((m) => m.id === id)?.text.slice(0, 80) ?? id,
  search(query, limit) {
    const q = query.toLowerCase()
    return board
      .list()
      .reverse()
      .filter((m) => !q || has(m.text, q) || has(m.author, q))
      .slice(0, limit)
      .map((m) => ({ kind: 'message', id: m.id, title: m.text.slice(0, 80), at: m.at }))
  },
  resolve: (ref) => (board.list().some((m) => m.id === ref) ? ref : null),
  line: (id) => board.list().find((m) => m.id === id)?.author ?? '',
  card(id, ctx) {
    return this.full(id, {}, ctx)
  },
  full(id) {
    const m = board.list().find((x) => x.id === id)
    if (!m) throw new ToolError(`No message ${id} on the board. find with kind message lists them.`)
    return board.text([m])
  },
  remove: (id) => board.remove(id)
}

const weblogLine = (e: WebLogEntry) => `${e.kind}, ${e.outcome}`

export const weblogKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Tools',
  kind: 'weblog',
  portability: { canExport: true, canImport: false },
  label: 'Web log',
  textParts: ['summary'],
  plural: 'Web log',
  exportable: true,
  icon: 'globe',
  description: 'every web search and page read agents made, with what was allowed (read only)',
  parts: ['summary'],
  actions: [],
  available: () => fs.existsSync(WEB_LOG),
  title: (id) => id,
  search(query, limit) {
    const q = query.toLowerCase()
    return readLines<WebLogEntry>(WEB_LOG)
      .map((e, i) => ({ e, i }))
      .reverse()
      .filter(({ e }) => !q || has(e.target, q))
      .slice(0, limit)
      .map(({ e, i }) => ({ kind: 'weblog', id: String(i), title: e.target.slice(0, 80), at: e.at }))
  },
  resolve: (ref) => (/^\d+$/.test(ref) ? ref : null),
  line: (id) => {
    const e = readLines<WebLogEntry>(WEB_LOG)[Number(id)]
    return e ? weblogLine(e) : ''
  },
  card(id, ctx) {
    return this.full(id, {}, ctx)
  },
  full(id) {
    const e = readLines<WebLogEntry>(WEB_LOG)[Number(id)]
    if (!e) throw new ToolError(`There is no web log entry ${id}. find with kind weblog lists them.`)
    return `${e.kind === 'search' ? 'Search' : 'Read'} ${e.target}: ${e.outcome} at ${new Date(e.at).toLocaleString()}${e.note ? ` (${e.note})` : ''}.`
  }
}

const DAY_ID = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

function dayTitle(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function dayFrom(ref: string): string | null {
  const r = ref.trim().replace(/^"|"$/g, '').toLowerCase()
  if (r === 'today') return dayKey(Date.now())
  if (r === 'yesterday') return dayKey(Date.now() - DAY_MS)
  if (DAY_ID.test(r)) return r
  return timeline.days(400).find((d) => dayTitle(d.day).toLowerCase() === r)?.day ?? null
}

interface ShownEvent {
  event: TimelineEvent
  kind: Kind
  id: string
  title: string
}

function shownEvents(events: TimelineEvent[], ctx: KindContext): ShownEvent[] {
  const rt = kindRt()
  const byKind = new Map(rt.kinds(ctx).map((k) => [k.kind, k]))
  const seen = new Map<string, { id: string; title: string } | null>()
  const look = (kindName: string, entry: string) => {
    const key = `${kindName}/${entry}`
    if (seen.has(key)) return seen.get(key)!
    const k = byKind.get(kindName)
    let found: { id: string; title: string } | null = null
    try {
      const id = k?.resolve(entry, ctx)
      if (k && id) found = { id, title: k.title(id) }
    } catch (err) {
      noteFailure(err, 'library', 'Could not resolve a link')
      found = null
    }
    seen.set(key, found)
    return found
  }
  const out: ShownEvent[] = []
  for (const event of events) {
    const k = byKind.get(event.kind)
    const hit = look(event.kind, event.entry)
    if (k && hit) out.push({ event, kind: k, id: hit.id, title: hit.title })
  }
  return out
}

function clock(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function eventLine(s: ShownEvent, ctx: KindContext, withLinks = true): string {
  const rt = kindRt()
  const e = s.event
  const agent = e.by ? (agentAccess.get(e.by)?.name ?? 'An agent') : null
  const you = ctx.user ? 'You' : 'The user'
  const who = agent ?? you
  const ref = withLinks ? linkFor(s.kind.kind, rt.entryId(s.kind, s.id, s.title, ctx)) : s.title
  let chat = ''
  if (e.chat && e.action !== 'talked' && withLinks) {
    const c = shownEvents([{ ...e, kind: 'chat', entry: e.chat }], ctx)[0]
    if (c) chat = ` in ${linkFor('chat', rt.entryId(c.kind, c.id, c.title, ctx))}`
  }
  if (e.action === 'talked') return `${you} and ${agent ?? 'an agent'} talked in ${ref}`
  if (e.action === 'remembered') return `${who} remembered something${ctx.user && withLinks ? ` (${ref})` : ''}${chat}`
  if (e.action === 'fired') return `A reminder went off: ${ref}`
  if (e.action === 'ran') return `Routine ${ref} ran${chat}`
  return `${who} ${e.action} ${s.kind.label.toLowerCase()} ${ref}${chat}`
}

const dayLine = (count: number) => `${count} thing${count === 1 ? '' : 's'} happened`

export const dayKind: Kind = {
  group: 'Time',
  kind: 'day',
  portability: { canExport: true, canImport: false },
  label: 'Day',
  plural: 'Days',
  icon: 'calendar-days',
  description: 'what happened on a day (who made, changed or talked about what), generated from the timeline each time it is read; today and yesterday work as names',
  parts: ['summary'],
  textParts: ['summary'],
  actions: [],
  exportable: true,
  export(id, ctx) {
    return { title: dayTitle(id), markdown: this.full(id, {}, ctx), json: shownEvents(timeline.day(id), ctx).map((s) => ({ ...s.event, title: s.title })) }
  },
  remove(id, ctx) {
    if (!ctx.user) throw new ToolError('Only the user can forget a day')
    timeline.forgetDay(id)
  },
  available: () => true,
  title: (id) => dayTitle(id),
  search(query, limit, ctx) {
    const q = query.trim().toLowerCase()
    return timeline
      .days(400)
      .filter((d) => !q || d.day.includes(q) || dayTitle(d.day).toLowerCase().includes(q))
      .map((d) => ({ d, count: shownEvents(timeline.day(d.day), ctx).length }))
      .filter((x) => x.count > 0)
      .slice(0, limit)
      .map(({ d }) => ({ kind: 'day', id: d.day, title: dayTitle(d.day), at: d.last }))
  },
  resolve: (ref) => dayFrom(ref),
  line: (id, ctx) => dayLine(shownEvents(timeline.day(id), ctx).length),
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  full(id, _options, ctx) {
    const shown = shownEvents(timeline.day(id), ctx)
    const today = dayKey(Date.now())
    const when = id === today ? ' (today)' : id === dayKey(Date.now() - DAY_MS) ? ' (yesterday)' : ''
    const lines = shown.map((s) => {
      const span = s.event.last - s.event.at > 5 * 60_000 ? `${clock(s.event.at)}–${clock(s.event.last)}` : clock(s.event.at)
      return `- ${span} ${eventLine(s, ctx, true)}`
    })
    return `# ${dayTitle(id)}${when}\nGenerated from the timeline each time it is read, so it is always current.\n\n${lines.join('\n') || 'Nothing recorded.'}`
  }
}

function eventWhat(e: TimelineEvent, ctx: KindContext): string {
  const agent = e.by ? (agentAccess.get(e.by)?.name ?? 'An agent') : null
  const who = agent ?? (ctx.user ? 'You' : 'The user')
  if (e.action === 'talked') return `Talked with ${agent ?? 'an agent'}`
  if (e.action === 'remembered') return `${who} remembered something`
  if (e.action === 'fired') return 'Reminder went off'
  if (e.action === 'ran') return 'Routine ran'
  return `${who} ${e.action} it`
}

export function describeEvent(e: TimelineEvent): string {
  const shown = shownEvents([e], USER)[0]
  return shown ? eventLine(shown, USER) : `${e.kind} ${e.action}`
}

export function resolveRoutineEntry(kindName: string, link: string): string {
  const k = kindRt().kindFor(kindName, USER)
  if (!k) throw notFound(new Error(`No kind "${kindName}"`))
  const raw = link.trim()
  const ref = raw.startsWith('@') ? splitLink(raw).ref : raw
  const id = k.resolve(ref, USER)
  if (!id) throw notFound(new Error(`There is no ${k.label.toLowerCase()} called "${ref}". Use the exact name or @${k.kind} link of one that exists.`))
  return id
}

function routineWhen(r: Routine): string {
  if (r.when.type === 'schedule') {
    const repeat = ROUTINE_REPEATS.find((x) => x.id === (r.when as { repeat: string }).repeat)?.label.toLowerCase() ?? ''
    return `${repeat}, from ${new Date(r.when.at).toLocaleString()}`
  }
  const w = r.when
  const k = kindRt().kindFor(w.kind, USER)
  let what = k ? `a ${k.label.toLowerCase()}` : w.kind
  if (w.entry && k) {
    try {
      what = linkFor(k.kind, k.title(w.entry))
    } catch (err) {
      noteFailure(err, 'library', "Could not read a board widget's entry")
      what = w.entry
    }
  }
  return `when ${what} is ${w.action === 'any' ? 'made or changed' : w.action}${w.byUser ? ' by the user' : ''}`
}

const routineLine = (r: Parameters<typeof routineWhen>[0] & { enabled: boolean }) => `${r.enabled ? '' : 'off · '}${routineWhen(r)}`

export const routineKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  ...storePacking({ find: (id) => routines.get(id), names: () => routines.list().map((r) => r.name), save: (x) => routines.save(x as unknown as Parameters<typeof routines.save>[0]), drop: ['next', 'lastRun', 'lastChat', 'lastError', 'running', 'enabled'], refs: [{ key: 'agentId', kind: () => 'agent' }] }),
  group: 'Time',
  kind: 'routine',
  label: 'Routine',
  plural: 'Routines',
  icon: 'workflow',
  description: 'unattended work the user set up: which agent, what it does, when, and where the result goes; only the user can make or change them',
  parts: [],
  actions: [],
  exportable: true,
  export(id) {
    return withJson(this, id, routines.get(id))
  },
  remove(id, ctx) {
    if (!ctx.user) throw new ToolError('Only the user can delete a routine')
    routines.delete(id)
  },
  rename(id, name, ctx) {
    if (!ctx.user) throw new ToolError('Only the user can rename a routine')
    routines.rename(id, name)
  },
  available: () => true,
  title: (id) => routines.get(id)?.name ?? id,
  search(query, limit) {
    const q = query.trim().toLowerCase()
    return routines
      .list()
      .filter((r) => !q || has(r.name, q) || has(r.instruction, q))
      .slice(0, limit)
      .map((r) => ({ kind: 'routine', id: r.id, title: r.name, at: r.lastRun ?? r.updatedAt }))
  },
  resolve: (ref) => routines.get(ref)?.id ?? null,
  line: (id) => {
    const r = routines.get(id)
    return r ? routineLine(r) : ''
  },
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  full(id) {
    const r = routines.get(id)
    if (!r) throw new ToolError(`No routine ${id}`)
    const agent = agentAccess.get(r.agentId)?.name ?? 'a missing agent'
    const out = [r.output.chat === 'same' ? 'one ongoing chat' : 'a new chat each run', r.output.page ? `added to ${linkFor('page', r.output.page)}` : '', r.output.notify ? 'a notification' : ''].filter(Boolean).join(', ')
    return [
      `# ${r.name}`,
      `${r.enabled ? 'On' : 'Off'}. ${agent} runs it ${routineWhen(r)}.`,
      `Result goes to: ${out}.`,
      r.next ? `Next run: ${new Date(r.next).toLocaleString()}.` : '',
      r.lastRun ? `Last run: ${new Date(r.lastRun).toLocaleString()}${r.lastError ? ` (failed: ${r.lastError})` : ''}.` : 'Not run yet.',
      `\nInstruction:\n${r.instruction}`
    ]
      .filter(Boolean)
      .join('\n')
  }
}

export function timelineRows(limit: number, ctx: KindContext = USER): TimelineRow[] {
  return shownEvents(timeline.recent(limit), ctx)
    .slice(0, limit)
    .map((s) => ({ kind: s.kind.kind, id: s.id, title: s.title, icon: s.kind.icon, label: s.kind.label, what: eventWhat(s.event, ctx), at: s.event.last }))
}
