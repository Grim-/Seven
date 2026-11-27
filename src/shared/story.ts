import { dayKey } from './timeline'
import { referencePattern, relinkText } from './text'
import { linkTagOf, searchRelationships, type RelationshipEntry } from './relationships'

export const STORY_PHASES = ['session', 'recent', 'backstory'] as const
export type StoryPhase = (typeof STORY_PHASES)[number]

export const STORY_THREAD_KINDS = ['arc', 'goal', 'mystery', 'bond', 'threat'] as const
export type StoryThreadKind = (typeof STORY_THREAD_KINDS)[number]

export const STORY_THREAD_STATUSES = ['active', 'waiting', 'resolved', 'dropped'] as const
export type StoryThreadStatus = (typeof STORY_THREAD_STATUSES)[number]

export const STORY_ENTRY_KINDS = ['scene', 'interaction', 'milestone', 'downtime'] as const
export type StoryEntryKind = (typeof STORY_ENTRY_KINDS)[number]

export const STORY_MEMORY_CATEGORIES = ['memory', 'backstory', 'recent', 'relationship', 'secret'] as const
export type StoryMemoryCategory = (typeof STORY_MEMORY_CATEGORIES)[number]

export interface StoryMemory {
  id: string
  category: StoryMemoryCategory
  summary: string
  detail?: string
  when?: string
  where?: string
  who?: string[]
  tags?: string[]
  pinned?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface StorySession {
  id: string
  date: string
  title: string
  notes: string
  phase?: StoryPhase
  kind?: StoryEntryKind
  summary?: string
  outcome?: string
  where?: string
  who?: string[]
  tags?: string[]
  pinned?: boolean
}

export interface StoryThread {
  id?: string
  text: string
  done: boolean
  kind?: StoryThreadKind
  status?: StoryThreadStatus
  detail?: string
  who?: string[]
  where?: string
  pinned?: boolean
  updatedAt?: string
}

export interface Story {
  where: string
  doing?: string
  goal?: string
  mood?: string
  backstorySummary?: string
  threads: StoryThread[]
  sessions: StorySession[]
}

export interface StoryRef {
  kind: string
  ref: string
  sessions: number[]
}

export interface StoryRecallHit {
  kind: 'memory' | 'log' | 'relationship' | 'thread' | 'knowledge'
  id: string
  label: string
  summary: string
  detail: string
  outcome?: string
  where: string
  who: string[]
  tags: string[]
  when: string
  pinned: boolean
  score: number
}

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'always', 'another', 'around', 'because', 'before', 'being',
  'between', 'both', 'could', 'doing', 'during', 'each', 'either', 'every', 'from', 'have', 'having',
  'here', 'hers', 'herself', 'himself', 'into', 'just', 'like', 'more', 'most', 'much', 'must', 'neither',
  'never', 'only', 'other', 'ours', 'ourselves', 'over', 'said', 'same', 'several', 'she', 'should',
  'since', 'some', 'such', 'than', 'that', 'their', 'theirs', 'them', 'themselves', 'then', 'there',
  'these', 'they', 'this', 'those', 'through', 'under', 'until', 'very', 'want', 'were', 'what', 'when',
  'where', 'which', 'while', 'whom', 'whose', 'will', 'with', 'would', 'your', 'yours', 'yourself'
])

export function blankStory(): Story {
  return { where: '', threads: [], sessions: [] }
}

export function newSession(date = dayKey(Date.now()), patch?: Partial<StorySession>): StorySession {
  return {
    id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    date,
    title: '',
    notes: '',
    phase: 'session',
    ...patch
  }
}

export function newMemory(input: Partial<StoryMemory> & { summary: string }): StoryMemory {
  const now = dayKey(Date.now())
  return {
    id: input.id?.trim() || `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    category: cleanCategory(input.category),
    summary: input.summary.trim(),
    detail: input.detail?.trim() || undefined,
    when: input.when?.trim() || undefined,
    where: input.where?.trim() || undefined,
    who: cleanTags(input.who),
    tags: cleanTags(input.tags),
    pinned: input.pinned === true ? true : undefined,
    createdAt: input.createdAt?.trim() || now,
    updatedAt: now
  }
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '')
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object') : [])

function cleanTags(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    const val = typeof item === 'string' ? item.trim() : ''
    if (!val) continue
    const key = val.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(val)
  }
  return out.length ? out : undefined
}

function cleanPhase(raw: unknown): StoryPhase {
  return typeof raw === 'string' && (STORY_PHASES as readonly string[]).includes(raw) ? (raw as StoryPhase) : 'session'
}

function cleanThreadKind(raw: unknown): StoryThreadKind | undefined {
  return typeof raw === 'string' && (STORY_THREAD_KINDS as readonly string[]).includes(raw) ? (raw as StoryThreadKind) : undefined
}

function cleanThreadStatus(raw: unknown, done: boolean): StoryThreadStatus {
  if (typeof raw === 'string' && (STORY_THREAD_STATUSES as readonly string[]).includes(raw)) return raw as StoryThreadStatus
  return done ? 'resolved' : 'active'
}

function cleanEntryKind(raw: unknown): StoryEntryKind | undefined {
  return typeof raw === 'string' && (STORY_ENTRY_KINDS as readonly string[]).includes(raw) ? (raw as StoryEntryKind) : undefined
}

export function newThread(input: Partial<StoryThread> & { text: string }): StoryThread {
  const status = cleanThreadStatus(input.status, input.done === true)
  return {
    id: input.id?.trim() || `thr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    text: input.text.trim(),
    done: status === 'resolved' || status === 'dropped',
    kind: input.kind ?? 'arc',
    status,
    ...(input.detail?.trim() ? { detail: input.detail.trim() } : {}),
    ...(input.who?.length ? { who: input.who } : {}),
    ...(input.where?.trim() ? { where: input.where.trim() } : {}),
    ...(input.pinned ? { pinned: true } : {}),
    updatedAt: dayKey(Date.now())
  }
}

export function storyHasContent(s: Story): boolean {
  return Boolean(
    s.where.trim() ||
      s.doing?.trim() ||
      s.goal?.trim() ||
      s.mood?.trim() ||
      s.backstorySummary?.trim() ||
      s.threads.length ||
      s.sessions.length
  )
}

function cleanCategory(raw: unknown): StoryMemoryCategory {
  return typeof raw === 'string' && (STORY_MEMORY_CATEGORIES as readonly string[]).includes(raw) ? (raw as StoryMemoryCategory) : 'memory'
}

export function cleanMemories(raw: unknown): StoryMemory[] {
  return list(raw)
    .map((m, i) => {
      const summary = text(m.summary).trim()
      if (!summary) return null
      const detail = text(m.detail).trim() || undefined
      const when = text(m.when).trim() || undefined
      const where = text(m.where).trim() || undefined
      const who = cleanTags(m.who)
      const tags = cleanTags(m.tags)
      const createdAt = text(m.createdAt).trim() || undefined
      const updatedAt = text(m.updatedAt).trim() || undefined
      const entry: StoryMemory = {
        id: text(m.id).trim() || `mem_${i}`,
        category: cleanCategory(m.category),
        summary,
        ...(detail ? { detail } : {}),
        ...(when ? { when } : {}),
        ...(where ? { where } : {}),
        ...(who ? { who } : {}),
        ...(tags ? { tags } : {}),
        ...(m.pinned === true ? { pinned: true } : {}),
        ...(createdAt ? { createdAt } : {}),
        ...(updatedAt ? { updatedAt } : {})
      }
      return entry
    })
    .filter((m): m is StoryMemory => m !== null)
}

function fromOldLog(dnd: Record<string, unknown>): Story {
  const days = new Map<string, string[]>()
  for (const e of list(dnd.log)) {
    const t = text(e.text).trim()
    if (!t) continue
    const date = text(e.date) || dayKey(Date.now())
    days.set(date, [...(days.get(date) ?? []), t])
  }
  return {
    where: text(dnd.where),
    threads: [],
    sessions: [...days].map(([date, lines], i) => ({ id: `old${i}`, date, title: '', notes: lines.join('\n\n'), phase: 'session' }))
  }
}

export function cleanStory(raw: unknown, oldDnd?: unknown): Story {
  if (!raw || typeof raw !== 'object') return oldDnd && typeof oldDnd === 'object' ? fromOldLog(oldDnd as Record<string, unknown>) : blankStory()
  const s = raw as Record<string, unknown>
  const doing = text(s.doing).trim() || undefined
  const goal = text(s.goal).trim() || undefined
  const mood = text(s.mood).trim() || undefined
  const backstorySummary = text(s.backstorySummary).trim() || undefined
  return {
    where: text(s.where),
    ...(doing ? { doing } : {}),
    ...(goal ? { goal } : {}),
    ...(mood ? { mood } : {}),
    ...(backstorySummary ? { backstorySummary } : {}),
    threads: list(s.threads)
      .map((t, i): StoryThread | null => {
        const title = text(t.text).trim()
        if (!title) return null
        const status = cleanThreadStatus(t.status, t.done === true)
        const done = status === 'resolved' || status === 'dropped'
        const kind = cleanThreadKind(t.kind)
        const detail = text(t.detail).trim() || undefined
        const who = cleanTags(t.who)
        const where = text(t.where).trim() || undefined
        const id = text(t.id).trim() || `thr_${i}`
        const updatedAt = text(t.updatedAt).trim() || undefined
        return {
          id,
          text: title,
          done,
          ...(kind ? { kind } : {}),
          ...(status !== 'active' ? { status } : {}),
          ...(detail ? { detail } : {}),
          ...(who ? { who } : {}),
          ...(where ? { where } : {}),
          ...(t.pinned === true ? { pinned: true } : {}),
          ...(updatedAt ? { updatedAt } : {})
        }
      })
      .filter((t): t is StoryThread => t !== null),
    sessions: list(s.sessions).map((x, i) => {
      const phase = cleanPhase(x.phase)
      const kind = cleanEntryKind(x.kind)
      const summary = text(x.summary).trim() || undefined
      const outcome = text(x.outcome).trim() || undefined
      const where = text(x.where).trim() || undefined
      const who = cleanTags(x.who)
      const tags = cleanTags(x.tags)
      return {
        id: text(x.id) || `s${i}`,
        date: text(x.date),
        title: text(x.title),
        notes: text(x.notes),
        ...(phase !== 'session' ? { phase } : {}),
        ...(kind ? { kind } : {}),
        ...(summary ? { summary } : {}),
        ...(outcome ? { outcome } : {}),
        ...(where ? { where } : {}),
        ...(who ? { who } : {}),
        ...(tags ? { tags } : {}),
        ...(x.pinned === true ? { pinned: true } : {})
      }
    })
  }
}

function trimSnippet(body: string, limit = 260): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  if (flat.length <= limit) return flat
  return `${flat.slice(0, limit - 1).trimEnd()}…`
}

function sessionSummaryLine(s: StorySession, n: number): string {
  const kind = s.kind && s.kind !== 'scene' ? `${s.kind} · ` : ''
  const phase = s.phase && s.phase !== 'session' ? `${s.phase} · ` : ''
  const head = `${phase}${kind}Log #${n}${s.title ? `: ${s.title}` : ''}${s.date ? ` (${s.date})` : ''}`
  const meta = [s.where ? `@${s.where}` : '', s.who?.length ? `with ${s.who.join(', ')}` : ''].filter(Boolean).join(' · ')
  const snippet = s.summary?.trim() || trimSnippet(s.notes, 240) || 'No notes.'
  const outcome = s.outcome?.trim() ? ` -> Outcome: ${trimSnippet(s.outcome, 120)}` : ''
  const truncated = !s.summary?.trim() && s.notes.replace(/\s+/g, ' ').trim().length > 240
  return `- [${head}${meta ? ` · ${meta}` : ''}] ${snippet}${outcome} (${s.id}${truncated ? ', truncated' : ''})`
}

function threadLine(t: StoryThread): string {
  const status = cleanThreadStatus(t.status, t.done)
  const meta = [t.kind ?? 'arc', status !== 'active' ? status : '', t.where ? `@${t.where}` : '', t.who?.length ? `with ${t.who.join(', ')}` : ''].filter(Boolean).join(' · ')
  const note = t.detail?.trim() ? ` — ${trimSnippet(t.detail, 140)}` : ''
  return `- [${meta}] ${t.text}${note}`
}

export function storyText(story: Story, roleplay = false): string {
  const nowLines = [
    story.where ? `Where: ${story.where}` : '',
    story.doing ? `Doing right now: ${story.doing}` : '',
    story.goal ? `Current focus: ${story.goal}` : '',
    story.mood ? `State / stakes: ${story.mood}` : ''
  ].filter(Boolean)

  const activeThreads = story.threads.filter((t) => {
    const st = cleanThreadStatus(t.status, t.done)
    return st === 'active' || (st === 'waiting' && t.pinned)
  })
  const closedThreadCount = story.threads.length - activeThreads.length

  const backstory = story.sessions.filter((s) => s.phase === 'backstory')
  const pinnedBackstory = backstory.filter((s) => s.pinned)
  const chronicle = story.sessions.filter((s) => s.phase !== 'backstory')

  const recentCount = roleplay ? 1 : 2
  const recentShown = chronicle.slice(-recentCount)
  const pinnedChronicle = chronicle.slice(0, Math.max(0, chronicle.length - recentShown.length)).filter((s) => s.pinned)
  const earlierChronicleCount = Math.max(0, chronicle.length - recentShown.length - pinnedChronicle.length)

  const parts = [
    nowLines.length ? nowLines.join('\n') : 'Where: not set',
    story.backstorySummary?.trim() ? `Core backstory: ${trimSnippet(story.backstorySummary, 420)}` : '',
    pinnedBackstory.length
      ? `Pinned backstory:\n${pinnedBackstory.map((s) => sessionSummaryLine(s, story.sessions.indexOf(s) + 1)).join('\n')}`
      : '',
    activeThreads.length
      ? `Active story threads:\n${activeThreads.slice(0, roleplay ? 6 : 10).map(threadLine).join('\n')}${closedThreadCount ? `\n(${closedThreadCount} waiting/resolved thread(s) searchable via character_search_knowledge)` : ''}`
      : closedThreadCount
        ? `Story threads: ${closedThreadCount} resolved/archived (searchable via character_search_knowledge).`
        : '',
    pinnedChronicle.length
      ? `Pinned key scenes:\n${pinnedChronicle.map((s) => sessionSummaryLine(s, story.sessions.indexOf(s) + 1)).join('\n')}`
      : '',
    recentShown.length
      ? `Latest story log:\n${recentShown.map((s) => sessionSummaryLine(s, story.sessions.indexOf(s) + 1)).join('\n')}`
      : '',
    earlierChronicleCount || backstory.length > pinnedBackstory.length
      ? `Archived story: ${earlierChronicleCount} earlier scene(s), ${backstory.length - pinnedBackstory.length} backstory entry(ies). Relevant snippets surface automatically; call character_search_knowledge to search or read full notes by id.`
      : ''
  ]
  return parts.filter(Boolean).join('\n\n')
}

export function mindMemoriesText(memories: StoryMemory[]): string {
  if (!memories.length) return ''
  const pinned = memories.filter((m) => m.pinned)
  const unpinnedCount = memories.length - pinned.length
  const parts = [
    pinned.length
      ? `Pinned personal memories:\n${pinned.map((m) => formatStorySnippet(memoryToHit(m, 1))).join('\n')}`
      : '',
    unpinnedCount
      ? `Stored character memories: ${unpinnedCount} unpinned memory(ies). Relevant snippets surface automatically when triggered; call character_search_knowledge to search or read full detail by id.`
      : ''
  ]
  return parts.filter(Boolean).join('\n\n')
}

export function refsIn(body: string): { kind: string; ref: string }[] {
  const seen = new Set<string>()
  const out: { kind: string; ref: string }[] = []
  for (const m of body.matchAll(referencePattern())) {
    const kind = m[2].toLowerCase()
    const ref = m[3].replace(/^"|"$/g, '')
    const key = `${kind}:${ref.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ kind, ref })
  }
  return out
}

export function refName(ref: string): string {
  return /\s/.test(ref) ? ref : ref.replace(/[-_]+/g, ' ')
}

export function storyRefs(story: Story): StoryRef[] {
  const found = new Map<string, StoryRef>()
  const scan = (body: string, session: number | null) => {
    if (!body) return
    for (const { kind, ref } of refsIn(body)) {
      const key = `${kind}:${ref.toLowerCase()}`
      const hit = found.get(key) ?? { kind, ref, sessions: [] }
      if (session !== null && !hit.sessions.includes(session)) hit.sessions.push(session)
      found.set(key, hit)
    }
  }
  scan([story.where, story.doing ?? '', story.goal ?? '', story.mood ?? '', story.backstorySummary ?? ''].join('\n'), null)
  story.threads.forEach((t) => scan([t.text, t.detail ?? '', t.where ?? '', ...(t.who ?? [])].join('\n'), null))
  story.sessions.forEach((s, i) => {
    scan([s.title, s.summary ?? '', s.outcome ?? '', s.where ?? '', ...(s.who ?? []), s.notes].join('\n'), i + 1)
  })
  return [...found.values()]
}

export function relinkStory(story: Story, kind: string, ref: string, to: string): Story {
  const fix = <T extends string | undefined>(v: T): T => (v === undefined ? v : relinkText(v, kind, ref, to)) as T
  const fixAll = (list: string[] | undefined) => list?.map((v) => relinkText(v, kind, ref, to)).filter((v) => v.trim())
  return {
    ...story,
    where: fix(story.where),
    doing: fix(story.doing),
    goal: fix(story.goal),
    mood: fix(story.mood),
    backstorySummary: fix(story.backstorySummary),
    threads: story.threads.map((t) => ({ ...t, text: fix(t.text), detail: fix(t.detail), where: fix(t.where), who: fixAll(t.who) })),
    sessions: story.sessions.map((s) => ({ ...s, title: fix(s.title), summary: fix(s.summary), outcome: fix(s.outcome), where: fix(s.where), notes: fix(s.notes), who: fixAll(s.who) }))
  }
}

function normalizeText(raw: string): string {
  return raw
    .replace(/@[a-z_]+:/gi, ' ')
    .replace(/[-_]+/g, ' ')
    .toLowerCase()
}

export function queryTerms(raw: string): string[] {
  const words = normalizeText(raw).match(/[a-z0-9]{3,}/g) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const w of words) {
    if (STOP_WORDS.has(w) || seen.has(w)) continue
    seen.add(w)
    out.push(w)
  }
  return out
}

function tokenSet(raw: string): string[] {
  return normalizeText(raw).match(/[a-z0-9]{2,}/g) ?? []
}

function scoreField(terms: string[], fieldText: string, exactWeight: number, prefixWeight: number): number {
  if (!fieldText) return 0
  const words = tokenSet(fieldText)
  if (!words.length) return 0
  const wordSet = new Set(words)
  let score = 0
  for (const term of terms) {
    if (wordSet.has(term)) {
      score += exactWeight
      continue
    }
    if (term.length >= 4 && words.some((w) => w.length >= 4 && (w.startsWith(term) || term.startsWith(w)))) {
      score += prefixWeight
    }
  }
  return score
}

function memoryToHit(m: StoryMemory, score: number): StoryRecallHit {
  return {
    kind: 'memory',
    id: m.id,
    label: m.category,
    summary: m.summary,
    detail: m.detail ?? '',
    where: m.where ?? '',
    who: m.who ?? [],
    tags: m.tags ?? [],
    when: m.when ?? m.updatedAt ?? m.createdAt ?? '',
    pinned: m.pinned === true,
    score
  }
}

function sessionToHit(s: StorySession, index: number, score: number): StoryRecallHit {
  const phase = s.phase ?? 'session'
  const fallbackSummary = trimSnippet(s.notes, 180)
  const summary = s.summary?.trim() || (s.title ? `${s.title}${fallbackSummary ? ` — ${fallbackSummary}` : ''}` : fallbackSummary) || `Session ${index + 1}`
  return {
    kind: 'log',
    id: s.id,
    label: phase,
    summary,
    detail: s.notes.trim(),
    ...(s.outcome?.trim() ? { outcome: s.outcome.trim() } : {}),
    where: s.where ?? '',
    who: s.who ?? [],
    tags: s.tags ?? [],
    when: s.date,
    pinned: false,
    score
  }
}

function relationshipToHit(r: RelationshipEntry, score: number): StoryRecallHit {
  const aff = typeof r.affinity === 'number' ? ` ${r.affinity >= 0 ? `+${r.affinity}` : r.affinity}` : ''
  const link = r.ref ? ` (${linkTagOf(r.ref)})` : ''
  const role = r.role ? ` — ${r.role}` : ''
  const note = r.notes ? `: ${r.notes}` : ''
  return {
    kind: 'relationship',
    id: r.id,
    label: `relationship · ${r.category} · ${r.stance}${aff}`,
    summary: `${r.target}${link}${role}${note}`,
    detail: [r.notes, r.secret ? `Secret: ${r.secret}` : ''].filter(Boolean).join('\n\n'),
    where: r.category === 'place' ? (r.ref ? linkTagOf(r.ref) : r.target) : '',
    who: r.category === 'person' ? [r.target] : [],
    tags: r.tags ?? [],
    when: '',
    pinned: r.pinned === true,
    score
  }
}

function threadToHit(t: StoryThread, index: number, score: number): StoryRecallHit {
  const status = cleanThreadStatus(t.status, t.done)
  return {
    kind: 'thread',
    id: t.id ?? `thr_${index}`,
    label: `thread · ${t.kind ?? 'arc'} · ${status}`,
    summary: t.text,
    detail: t.detail ?? '',
    where: t.where ?? '',
    who: t.who ?? [],
    tags: [],
    when: t.updatedAt ?? '',
    pinned: t.pinned === true,
    score
  }
}

export interface KnownItem {
  ref: string
  name: string
  text: string
  tags: string[]
  scope: string
  pinned?: boolean
}

function knowledgeToHit(k: KnownItem, score: number): StoryRecallHit {
  return {
    kind: 'knowledge',
    id: k.ref,
    label: `knowledge · ${k.scope}`,
    summary: `${k.name} — ${trimSnippet(k.text, 180)}`,
    detail: k.text.trim(),
    where: '',
    who: [],
    tags: k.tags,
    when: '',
    pinned: k.pinned === true,
    score
  }
}

export function storyHitById(story: Story, id: string, memories: StoryMemory[] = [], relationships: RelationshipEntry[] = [], known: KnownItem[] = []): StoryRecallHit | null {
  const needle = id.trim()
  if (!needle) return null
  const k = known.find((x) => x.ref === needle || `@knowledge:${x.ref}` === needle)
  if (k) return knowledgeToHit(k, 100)
  const rel = relationships.find((r) => r.id === needle)
  if (rel) return relationshipToHit(rel, 100)
  const mem = memories.find((m) => m.id === needle)
  if (mem) return memoryToHit(mem, 100)
  const thrIdx = story.threads.findIndex((t, i) => (t.id ?? `thr_${i}`) === needle)
  if (thrIdx >= 0) return threadToHit(story.threads[thrIdx], thrIdx, 100)
  const idx = story.sessions.findIndex((s) => s.id === needle)
  if (idx >= 0) return sessionToHit(story.sessions[idx], idx, 100)
  return null
}

export function formatStorySnippet(hit: StoryRecallHit, sheetTitle?: string): string {
  const meta = [
    sheetTitle,
    hit.label,
    hit.when || '',
    hit.where || '',
    hit.who.length ? `with ${hit.who.join(', ')}` : ''
  ]
    .filter(Boolean)
    .join(' · ')
  return `- [${meta}] ${hit.summary} (${hit.id})`
}

export function searchStoryItems(
  story: Story,
  query: string,
  opts?: { category?: string; where?: string; includePinned?: boolean; memories?: StoryMemory[]; relationships?: RelationshipEntry[]; known?: KnownItem[] }
): StoryRecallHit[] {
  const terms = queryTerms(query)
  const whereFilter = opts?.where ? normalizeText(opts.where).trim() : ''
  const catFilter = opts?.category?.trim().toLowerCase() || ''
  const includePinned = opts?.includePinned !== false
  const memories = opts?.memories ?? []
  const hits: StoryRecallHit[] = []

  for (const m of memories) {
    if (!includePinned && m.pinned) continue
    if (catFilter && m.category !== catFilter && catFilter !== 'all') continue
    if (whereFilter && !normalizeText(m.where ?? '').includes(whereFilter)) continue
    if (!terms.length) {
      hits.push(memoryToHit(m, m.pinned ? 2 : 1))
      continue
    }
    const metaText = [m.where ?? '', ...(m.who ?? []), ...(m.tags ?? [])].join(' ')
    const score =
      scoreField(terms, metaText, 6, 3) +
      scoreField(terms, m.summary, 5, 2) +
      scoreField(terms, m.detail ?? '', 2, 1)
    if (score > 0) hits.push(memoryToHit(m, score))
  }

  for (let i = 0; i < story.sessions.length; i++) {
    const s = story.sessions[i]
    const phase = s.phase ?? 'session'
    if (catFilter && catFilter !== 'all' && catFilter !== 'log' && phase !== catFilter) continue
    if (whereFilter && !normalizeText(s.where ?? '').includes(whereFilter)) continue
    if (!terms.length) {
      hits.push(sessionToHit(s, i, 1))
      continue
    }
    const metaText = [s.where ?? '', ...(s.who ?? []), ...(s.tags ?? []), s.title].join(' ')
    const score =
      scoreField(terms, metaText, 6, 3) +
      scoreField(terms, s.summary ?? '', 5, 2) +
      scoreField(terms, s.notes, 2, 1)
    if (score > 0) hits.push(sessionToHit(s, i, score))
  }

  if (!catFilter || catFilter === 'all' || catFilter === 'thread') {
    for (let i = 0; i < story.threads.length; i++) {
      const t = story.threads[i]
      if (!includePinned && t.pinned) continue
      if (whereFilter && !normalizeText(t.where ?? '').includes(whereFilter)) continue
      if (!terms.length) {
        hits.push(threadToHit(t, i, t.done ? 0.5 : 2))
        continue
      }
      const metaText = [t.where ?? '', ...(t.who ?? []), t.kind ?? ''].join(' ')
      const score = scoreField(terms, metaText, 6, 3) + scoreField(terms, t.text, 5, 2) + scoreField(terms, t.detail ?? '', 2, 1)
      if (score > 0) hits.push(threadToHit(t, i, score))
    }
  }

  if (!catFilter || catFilter === 'all' || catFilter === 'relationship') {
    for (const { entry, score } of searchRelationships(opts?.relationships ?? [], query, { includePinned, where: opts?.where ?? null })) {
      hits.push(relationshipToHit(entry, score))
    }
  }

  if (!catFilter || catFilter === 'all' || catFilter === 'knowledge') {
    for (const k of opts?.known ?? []) {
      if (!includePinned && k.pinned) continue
      if (whereFilter) continue
      if (!terms.length) {
        hits.push(knowledgeToHit(k, 1))
        continue
      }
      const score = scoreField(terms, k.tags.join(' '), 6, 3) + scoreField(terms, k.name, 5, 2) + scoreField(terms, k.text, 2, 1)
      if (score > 0) hits.push(knowledgeToHit(k, score))
    }
  }

  return hits.sort((a, b) => b.score - a.score)
}
