import { dayKey } from './timeline'
import { referencePattern } from './text'

export const STORY_PHASES = ['session', 'recent', 'backstory'] as const
export type StoryPhase = (typeof STORY_PHASES)[number]

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
  summary?: string
  where?: string
  who?: string[]
  tags?: string[]
}

export interface StoryThread {
  text: string
  done: boolean
}

export interface Story {
  where: string
  threads: StoryThread[]
  sessions: StorySession[]
}

export interface StoryRef {
  kind: string
  ref: string
  sessions: number[]
}

export interface StoryRecallHit {
  kind: 'memory' | 'log'
  id: string
  label: string
  summary: string
  detail: string
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
  return {
    where: text(s.where),
    threads: list(s.threads)
      .map((t) => ({ text: text(t.text).trim(), done: t.done === true }))
      .filter((t) => t.text),
    sessions: list(s.sessions).map((x, i) => {
      const phase = cleanPhase(x.phase)
      const summary = text(x.summary).trim() || undefined
      const where = text(x.where).trim() || undefined
      const who = cleanTags(x.who)
      const tags = cleanTags(x.tags)
      return {
        id: text(x.id) || `s${i}`,
        date: text(x.date),
        title: text(x.title),
        notes: text(x.notes),
        ...(phase !== 'session' ? { phase } : {}),
        ...(summary ? { summary } : {}),
        ...(where ? { where } : {}),
        ...(who ? { who } : {}),
        ...(tags ? { tags } : {})
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
  const phase = s.phase && s.phase !== 'session' ? `${s.phase} · ` : ''
  const head = `${phase}Log #${n}${s.title ? `: ${s.title}` : ''}${s.date ? ` (${s.date})` : ''}`
  const meta = [s.where ? `@${s.where}` : '', s.who?.length ? `with ${s.who.join(', ')}` : ''].filter(Boolean).join(' · ')
  const snippet = s.summary?.trim() || trimSnippet(s.notes, 280) || 'No notes.'
  const truncated = !s.summary?.trim() && s.notes.replace(/\s+/g, ' ').trim().length > 280
  return `- [${head}${meta ? ` · ${meta}` : ''}] ${snippet} (${s.id}${truncated ? ', truncated' : ''})`
}

export function storyText(story: Story, roleplay = false): string {
  const open = story.threads.filter((t) => !t.done).map((t) => `- ${t.text}`)
  const recentCount = roleplay ? 1 : 2
  const shown = story.sessions.slice(-recentCount)
  const earlierCount = Math.max(0, story.sessions.length - shown.length)
  const parts = [
    `Now: ${story.where || 'not set'}`,
    open.length ? `Open threads:\n${open.join('\n')}` : '',
    shown.length ? `Latest story log:\n${shown.map((s) => sessionSummaryLine(s, story.sessions.indexOf(s) + 1)).join('\n')}` : '',
    earlierCount
      ? `Earlier story logs: ${earlierCount} archived log(s). Relevant logs surface automatically; call story_recall to search or read full notes by id.`
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
      ? `Stored character memories: ${unpinnedCount} unpinned memory(ies). Relevant snippets surface automatically when triggered; call story_recall to search or read full detail by id.`
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
  scan(story.where, null)
  story.threads.forEach((t) => scan(t.text, null))
  story.sessions.forEach((s, i) => {
    scan([s.title, s.summary ?? '', s.where ?? '', ...(s.who ?? []), s.notes].join('\n'), i + 1)
  })
  return [...found.values()]
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
    where: s.where ?? '',
    who: s.who ?? [],
    tags: s.tags ?? [],
    when: s.date,
    pinned: false,
    score
  }
}

export function storyHitById(story: Story, id: string, memories: StoryMemory[] = []): StoryRecallHit | null {
  const needle = id.trim()
  if (!needle) return null
  const mem = memories.find((m) => m.id === needle)
  if (mem) return memoryToHit(mem, 100)
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
  opts?: { category?: string; where?: string; includePinned?: boolean; memories?: StoryMemory[] }
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

  return hits.sort((a, b) => b.score - a.score)
}
