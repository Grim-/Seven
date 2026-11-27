import { cleanElements, type ChatElement } from './chatElements'
import { toId } from './ids'
import { cleanHold, holdIsEmpty, type CharacterHold } from './characterHold'
import { STORY_THREAD_KINDS, STORY_THREAD_STATUSES, type StoryThread, type StoryThreadKind, type StoryThreadStatus } from './story'

export const ALMANAC_ENTRY_KINDS = ['chat', 'combat', 'travel', 'milestone', 'world', 'scene', 'learned'] as const
export type AlmanacEntryKind = string

export interface AlmanacWorldTime {
  time: number
  day: number
  hour: number
  minute: number
  seq: number
  label?: string
}

export interface ArchivedChatMessage {
  id: string
  speaker: string
  role: 'user' | 'assistant'
  text: string
  elements?: ChatElement[]
}

export interface AlmanacEntry {
  id: string
  kind: string
  tags?: string[]
  when: AlmanacWorldTime
  where: string
  who: string[]
  threadIds: string[]
  title: string
  summary: string
  outcome: string
  secret?: string
  notes: string
  chatId?: string | null
  chatTitle?: string | null
  messages?: ArchivedChatMessage[]
  links: string[]
  pinned?: boolean
  createdAt: number
}

export interface AlmanacOpening {
  premise: string
  incitingIncident: string
  startingWhere: string
  startingTime: number
  tone?: string
  setting?: string
  timePeriod?: string
  startingMap?: string
  startingPlace?: string
  openingActionIds?: string[]
}

export interface BroadsheetDispatch {
  id: string
  headline: string
  kicker?: string
  body: string
  outcome?: string
  where?: string
  who: string[]
  day: number
  isLead?: boolean
}

export interface BroadsheetEdition {
  id: string
  editionNumber: number
  title: string
  subtitle?: string
  dayFrom: number
  dayTo: number
  createdAt: number
  lead: BroadsheetDispatch | null
  dispatches: BroadsheetDispatch[]
  threads: { text: string; kind: string; where?: string; status: string }[]
  places: string[]
  figures: string[]
  masthead?: string
}

export interface Almanac {
  id: string
  title: string
  worldId: string | null
  saveId: string | null
  clockId: string
  currentTime: number
  opening?: AlmanacOpening
  cast: string[]
  threads: StoryThread[]
  entries: AlmanacEntry[]
  editions?: BroadsheetEdition[]
  holds?: Record<string, CharacterHold>
  updatedAt: number
}

export type SessionSceneMode = 'gameplay' | 'meta'

export interface SessionSceneBinding {
  almanacId: string
  mode?: SessionSceneMode
  worldId?: string | null
  saveId?: string | null
  mapId?: string | null
  placeKey?: string | null
  playerSheet?: string | null
  where: string
  characters: string[]
  worldTime?: number | null
  archivedEntryId?: string | null
  parentSessionId?: string | null
  handoffNumber?: number
  eventId?: string | null
}

export function isGameplayScene(scene: SessionSceneBinding | null | undefined): boolean {
  return Boolean(scene?.worldId && (scene.mode ?? 'gameplay') === 'gameplay')
}

const HOUR_SECONDS = 3600
const HOURS_PER_DAY = 24
const DAY_SECONDS = HOUR_SECONDS * HOURS_PER_DAY

export function worldTimeFromSeconds(seconds: number, seq = 1, label?: string): AlmanacWorldTime {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  const day = Math.floor(safe / DAY_SECONDS) + 1
  const rem = safe % DAY_SECONDS
  const hour = Math.floor(rem / HOUR_SECONDS)
  const minute = Math.floor((rem % HOUR_SECONDS) / 60)
  return {
    time: safe,
    day,
    hour,
    minute,
    seq: Math.max(1, Math.floor(Number.isFinite(seq) ? seq : 1)),
    ...(label?.trim() ? { label: label.trim() } : {})
  }
}

export function worldSecondsFromDayTime(day: number, hour: number, minute: number): number {
  const d = Math.max(1, Math.floor(Number.isFinite(day) ? day : 1)) - 1
  const h = Math.max(0, Math.min(23, Math.floor(Number.isFinite(hour) ? hour : 0)))
  const m = Math.max(0, Math.min(59, Math.floor(Number.isFinite(minute) ? minute : 0)))
  return d * DAY_SECONDS + h * HOUR_SECONDS + m * 60
}

export function padClock(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0')
}

export function formatAlmanacClock(seconds: number): string {
  const wt = worldTimeFromSeconds(seconds, 1)
  return `Day ${wt.day} · ${padClock(wt.hour)}:${padClock(wt.minute)}`
}

export function formatAlmanacTime(when: AlmanacWorldTime): string {
  return `Day ${when.day} · ${padClock(when.hour)}:${padClock(when.minute)}${when.label ? ` (${when.label})` : ''}`
}

export function compareAlmanacTimeDesc(a: AlmanacWorldTime, b: AlmanacWorldTime): number {
  if (b.day !== a.day) return b.day - a.day
  const minsA = a.hour * 60 + a.minute
  const minsB = b.hour * 60 + b.minute
  if (minsB !== minsA) return minsB - minsA
  if (b.time !== a.time) return b.time - a.time
  return b.seq - a.seq
}

export function sortAlmanacEntries(entries: AlmanacEntry[], order: 'newest' | 'oldest' = 'newest'): AlmanacEntry[] {
  const copy = [...entries]
  copy.sort((a, b) => (order === 'newest' ? compareAlmanacTimeDesc(a.when, b.when) : compareAlmanacTimeDesc(b.when, a.when)))
  return copy
}

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v.trim() : fallback)
const strList = (v: unknown): string[] =>
  Array.isArray(v)
    ? [...new Set(v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean))]
    : typeof v === 'string' && v.trim()
      ? [v.trim()]
      : []

export function cleanAlmanacWorldTime(raw: unknown, fallbackSeconds = 0, fallbackSeq = 1): AlmanacWorldTime {
  const r = rec(raw)
  const hasExplicit = typeof r.day === 'number' || typeof r.hour === 'number' || typeof r.minute === 'number'
  const base = worldTimeFromSeconds(typeof r.time === 'number' && Number.isFinite(r.time) ? r.time : fallbackSeconds, fallbackSeq)
  const day = hasExplicit && typeof r.day === 'number' && Number.isFinite(r.day) ? Math.max(1, Math.floor(r.day)) : base.day
  const hour = hasExplicit && typeof r.hour === 'number' && Number.isFinite(r.hour) ? Math.max(0, Math.min(23, Math.floor(r.hour))) : base.hour
  const minute = hasExplicit && typeof r.minute === 'number' && Number.isFinite(r.minute) ? Math.max(0, Math.min(59, Math.floor(r.minute))) : base.minute
  const time = typeof r.time === 'number' && Number.isFinite(r.time) && !hasExplicit ? Math.max(0, Math.floor(r.time)) : worldSecondsFromDayTime(day, hour, minute)
  const seq = typeof r.seq === 'number' && Number.isFinite(r.seq) ? Math.max(1, Math.floor(r.seq)) : fallbackSeq
  const label = str(r.label)
  return { time, day, hour, minute, seq, ...(label ? { label } : {}) }
}

function cleanArchivedMessage(raw: unknown, index: number): ArchivedChatMessage | null {
  const r = rec(raw)
  const text = typeof r.text === 'string' ? r.text.trim() : ''
  const elements = cleanElements(r.elements)
  if (!text && !elements.length) return null
  const role = r.role === 'user' ? 'user' : 'assistant'
  const speaker = str(r.speaker) || (role === 'user' ? 'Player' : 'Agent')
  const id = str(r.id) || `m_${index + 1}`
  return { id, speaker, role, text, ...(elements.length ? { elements } : {}) }
}

function cleanThread(raw: unknown, index: number): StoryThread | null {
  const r = rec(raw)
  const text = str(r.text)
  if (!text) return null
  const kind = (STORY_THREAD_KINDS as readonly string[]).includes(str(r.kind)) ? (str(r.kind) as StoryThreadKind) : 'arc'
  const status = (STORY_THREAD_STATUSES as readonly string[]).includes(str(r.status))
    ? (str(r.status) as StoryThreadStatus)
    : r.done === true
      ? 'resolved'
      : 'active'
  return {
    id: str(r.id) || `th_${index + 1}`,
    text,
    done: status === 'resolved',
    kind,
    status,
    ...(str(r.detail) ? { detail: str(r.detail) } : {}),
    ...( Array.isArray(r.who) ? { who: strList(r.who) } : {}),
    ...(str(r.where) ? { where: str(r.where) } : {}),
    ...(r.pinned === true ? { pinned: true } : {}),
    ...(str(r.updatedAt) ? { updatedAt: str(r.updatedAt) } : {})
  }
}

export function cleanAlmanacEntry(raw: unknown, index = 0, fallbackTime = 0): AlmanacEntry | null {
  const r = rec(raw)
  const title = str(r.title)
  const summary = str(r.summary)
  const notes = typeof r.notes === 'string' ? r.notes.trim() : ''
  const messages = Array.isArray(r.messages)
    ? r.messages.map(cleanArchivedMessage).filter((m): m is ArchivedChatMessage => m !== null)
    : undefined
  if (!title && !summary && !notes && (!messages || !messages.length)) return null
  const rawKind = str(r.kind)
  const kind = rawKind || (messages?.length ? 'chat' : 'scene')
  const tags = strList(r.tags)
  const when = cleanAlmanacWorldTime(r.when, fallbackTime, index + 1)
  const where = str(r.where)
  const who = strList(r.who)
  const threadIds = strList(r.threadIds)
  const links = strList(r.links)
  const secret = str(r.secret)
  const chatId = str(r.chatId) || null
  const chatTitle = str(r.chatTitle) || null
  return {
    id: str(r.id) || `alm_${Date.now().toString(36)}_${index}`,
    kind,
    ...(tags.length ? { tags } : {}),
    when,
    where,
    who,
    threadIds,
    title: title || summary.slice(0, 72) || `Scene (${formatAlmanacTime(when)})`,
    summary: summary || notes.slice(0, 200),
    outcome: str(r.outcome),
    ...(secret ? { secret } : {}),
    notes,
    ...(chatId ? { chatId } : {}),
    ...(chatTitle ? { chatTitle } : {}),
    ...(messages?.length ? { messages } : {}),
    links,
    ...(r.pinned === true ? { pinned: true } : {}),
    createdAt: typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : Date.now()
  }
}

function cleanBroadsheetDispatch(raw: unknown, index: number): BroadsheetDispatch | null {
  const r = rec(raw)
  const headline = str(r.headline)
  const body = typeof r.body === 'string' ? r.body.trim() : ''
  if (!headline && !body) return null
  return {
    id: str(r.id) || `disp_${index + 1}`,
    headline: headline || body.slice(0, 64),
    ...(str(r.kicker) ? { kicker: str(r.kicker) } : {}),
    body,
    ...(str(r.outcome) ? { outcome: str(r.outcome) } : {}),
    ...(str(r.where) ? { where: str(r.where) } : {}),
    who: strList(r.who),
    day: typeof r.day === 'number' && Number.isFinite(r.day) ? Math.max(1, Math.floor(r.day)) : 1,
    ...(r.isLead === true ? { isLead: true } : {})
  }
}

function cleanBroadsheetEdition(raw: unknown, index: number): BroadsheetEdition | null {
  const r = rec(raw)
  const id = str(r.id) || `ed_${index + 1}`
  const title = str(r.title)
  if (!title) return null
  const dayFrom = typeof r.dayFrom === 'number' && Number.isFinite(r.dayFrom) ? Math.max(1, Math.floor(r.dayFrom)) : 1
  const dayTo = typeof r.dayTo === 'number' && Number.isFinite(r.dayTo) ? Math.max(dayFrom, Math.floor(r.dayTo)) : dayFrom
  const lead = r.lead ? cleanBroadsheetDispatch(r.lead, 0) : null
  const dispatches = Array.isArray(r.dispatches)
    ? r.dispatches.map(cleanBroadsheetDispatch).filter((d): d is BroadsheetDispatch => d !== null)
    : []
  const threads = Array.isArray(r.threads)
    ? r.threads
        .map((t) => {
          const tr = rec(t)
          const text = str(tr.text)
          if (!text) return null
          return {
            text,
            kind: str(tr.kind) || 'arc',
            ...(str(tr.where) ? { where: str(tr.where) } : {}),
            status: str(tr.status) || 'active'
          }
        })
        .filter((x): x is { text: string; kind: string; where?: string; status: string } => x !== null)
    : []
  return {
    id,
    editionNumber: typeof r.editionNumber === 'number' && Number.isFinite(r.editionNumber) ? Math.max(1, Math.floor(r.editionNumber)) : index + 1,
    title,
    ...(str(r.subtitle) ? { subtitle: str(r.subtitle) } : {}),
    dayFrom,
    dayTo,
    createdAt: typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : Date.now(),
    lead,
    dispatches,
    threads,
    places: strList(r.places),
    figures: strList(r.figures),
    ...(str(r.masthead) ? { masthead: str(r.masthead) } : {})
  }
}

function cleanHolds(raw: unknown): { holds?: Record<string, CharacterHold> } {
  const holds: Record<string, CharacterHold> = {}
  for (const [sheet, hold] of Object.entries(rec(raw))) {
    const clean = cleanHold(hold)
    if (!holdIsEmpty(clean)) holds[sheet] = clean
  }
  return Object.keys(holds).length ? { holds } : {}
}

export function cleanAlmanac(raw: unknown, fallbackId?: string): Almanac | null {
  const r = rec(raw)
  const title = str(r.title) || str(r.name)
  if (!title) return null
  const id = toId(str(r.id) || fallbackId || title)
  if (!id) return null
  const currentTime = typeof r.currentTime === 'number' && Number.isFinite(r.currentTime) ? Math.max(0, Math.floor(r.currentTime)) : 0
  const entries = Array.isArray(r.entries)
    ? r.entries.map((e, i) => cleanAlmanacEntry(e, i, currentTime)).filter((e): e is AlmanacEntry => e !== null)
    : []
  const threads = Array.isArray(r.threads)
    ? r.threads.map(cleanThread).filter((t): t is StoryThread => t !== null)
    : []
  const rawOpening = rec(r.opening)
  const openingActionIds = strList(rawOpening.openingActionIds)
  const opening: AlmanacOpening | undefined =
    str(rawOpening.premise) ||
    str(rawOpening.incitingIncident) ||
    str(rawOpening.startingWhere) ||
    str(rawOpening.tone) ||
    str(rawOpening.setting) ||
    str(rawOpening.timePeriod) ||
    str(rawOpening.startingPlace) ||
    str(rawOpening.startingMap) ||
    openingActionIds.length ||
    typeof rawOpening.startingTime === 'number'
      ? {
          premise: str(rawOpening.premise),
          incitingIncident: str(rawOpening.incitingIncident),
          startingWhere: str(rawOpening.startingWhere),
          startingTime:
            typeof rawOpening.startingTime === 'number' && Number.isFinite(rawOpening.startingTime)
              ? Math.max(0, Math.floor(rawOpening.startingTime))
              : currentTime,
          ...(str(rawOpening.tone) ? { tone: str(rawOpening.tone) } : {}),
          ...(str(rawOpening.setting) ? { setting: str(rawOpening.setting) } : {}),
          ...(str(rawOpening.timePeriod) ? { timePeriod: str(rawOpening.timePeriod) } : {}),
          ...(str(rawOpening.startingMap) ? { startingMap: str(rawOpening.startingMap) } : {}),
          ...(str(rawOpening.startingPlace) ? { startingPlace: str(rawOpening.startingPlace) } : {}),
          ...(openingActionIds.length ? { openingActionIds } : {})
        }
      : undefined
  const editions = Array.isArray(r.editions)
    ? r.editions.map(cleanBroadsheetEdition).filter((e): e is BroadsheetEdition => e !== null)
    : []
  return {
    id,
    title,
    worldId: str(r.worldId) || null,
    saveId: str(r.saveId) || null,
    clockId: str(r.clockId) || 'standard',
    currentTime,
    ...(opening ? { opening } : {}),
    cast: strList(r.cast),
    threads,
    entries: sortAlmanacEntries(entries, 'newest'),
    ...(editions.length ? { editions } : {}),
    ...cleanHolds(r.holds),
    updatedAt: typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : Date.now()
  }
}

export function cleanSessionScene(raw: unknown): SessionSceneBinding | null {
  const r = rec(raw)
  const almanacId = str(r.almanacId)
  const worldId = str(r.worldId) || null
  if (!almanacId && !worldId) return null
  const mode: SessionSceneMode | undefined = r.mode === 'meta' ? 'meta' : r.mode === 'gameplay' ? 'gameplay' : undefined
  return {
    almanacId,
    ...(mode ? { mode } : {}),
    worldId,
    saveId: str(r.saveId) || null,
    mapId: str(r.mapId) || null,
    placeKey: str(r.placeKey) || null,
    playerSheet: str(r.playerSheet) || null,
    where: str(r.where),
    characters: strList(r.characters),
    worldTime: typeof r.worldTime === 'number' && Number.isFinite(r.worldTime) ? Math.max(0, Math.floor(r.worldTime)) : null,
    archivedEntryId: str(r.archivedEntryId) || null,
    parentSessionId: str(r.parentSessionId) || null,
    ...(typeof r.handoffNumber === 'number' && Number.isFinite(r.handoffNumber) ? { handoffNumber: Math.max(1, Math.floor(r.handoffNumber)) } : {}),
    eventId: str(r.eventId) || null
  }
}

export interface AlmanacReadOptions {
  part?: string | null
  includeSecrets?: boolean
}

/** Render a structured markdown view of an Almanac, supporting #public, #day:N-M, #where:..., and #entry:... parts. */
export function almanacMarkdown(almanac: Almanac, opts: AlmanacReadOptions = {}): string {
  const part = (opts.part ?? '').trim()
  const lowerPart = part.toLowerCase()
  const isPublic = lowerPart.includes('public')
  const showSecrets = opts.includeSecrets !== false && !isPublic

  if (lowerPart.startsWith('entry:')) {
    const entryId = part.slice(6).trim()
    const entry = almanac.entries.find((e) => e.id === entryId || e.id.toLowerCase() === entryId.toLowerCase())
    if (!entry) return `No entry "${entryId}" in Almanac "${almanac.title}".`
    const lines = [
      `# ${entry.title}`,
      `- When: ${formatAlmanacTime(entry.when)} (#${entry.when.seq})`,
      ...(entry.tags?.length ? [`- Tags: ${entry.tags.map((t) => `#${t}`).join(' ')}`] : []),
      ...(entry.where ? [`- Where: ${entry.where}`] : []),
      ...(entry.who.length ? [`- Who: ${entry.who.join(', ')}`] : []),
      ...(entry.chatTitle || entry.chatId ? [`- Origin chat: ${entry.chatTitle ?? entry.chatId}${entry.chatId ? ` (@chat:${entry.chatId})` : ''}`] : []),
      ...(entry.summary ? [`\n**Summary:** ${entry.summary}`] : []),
      ...(entry.outcome ? [`**Outcome:** ${entry.outcome}`] : []),
      ...(showSecrets && entry.secret ? [`**Secret:** ${entry.secret}`] : []),
      ...(entry.notes ? [`\n${entry.notes}`] : [])
    ]
    if (entry.messages?.length) {
      lines.push('\n## Archived Transcript')
      for (const m of entry.messages) {
        lines.push(`**${m.speaker}:** ${m.text}`)
      }
    }
    return lines.join('\n')
  }

  let dayRange: [number, number] | null = null
  const dayMatch = /day:(\d+)(?:-(\d+))?/i.exec(part)
  if (dayMatch) {
    const d1 = parseInt(dayMatch[1], 10)
    const d2 = dayMatch[2] ? parseInt(dayMatch[2], 10) : d1
    dayRange = [Math.min(d1, d2), Math.max(d1, d2)]
  }
  const whereMatch = /where:([^\s#]+)/i.exec(part)
  const whereFilter = whereMatch ? whereMatch[1].toLowerCase() : null

  const filtered = sortAlmanacEntries(almanac.entries, 'newest').filter((e) => {
    if (dayRange && (e.when.day < dayRange[0] || e.when.day > dayRange[1])) return false
    if (whereFilter && !e.where.toLowerCase().includes(whereFilter)) return false
    return true
  })

  const activeThreads = almanac.threads.filter((t) => (t.status ?? (t.done ? 'resolved' : 'active')) !== 'resolved')
  const isSessionOne = almanac.entries.length === 0
  const head = [
    `# Almanac: ${almanac.title}`,
    `- Storyline stage: ${
      isSessionOne
        ? 'SESSION 1 — OPENING SCENE (no past chronicle events recorded yet; the story is beginning now)'
        : `Ongoing (${almanac.entries.length} recorded scene(s) on the chronicle)`
    }`,
    `- Current world clock: ${formatAlmanacClock(almanac.currentTime)}`,
    ...(almanac.worldId ? [`- World: @world:${almanac.worldId}${almanac.saveId ? ` (Save: ${almanac.saveId})` : ''}`] : []),
    ...(almanac.cast.length ? [`- Cast: ${almanac.cast.join(', ')}`] : [])
  ]

  if (almanac.opening && (almanac.opening.premise || almanac.opening.incitingIncident || almanac.opening.startingWhere || almanac.opening.tone || almanac.opening.setting || almanac.opening.timePeriod)) {
    head.push('\n## Story Opening (Session 1 Foundation)')
    if (almanac.opening.setting) head.push(`- **Setting:** ${almanac.opening.setting}`)
    if (almanac.opening.timePeriod) head.push(`- **Time Period / Era:** ${almanac.opening.timePeriod}`)
    if (almanac.opening.premise) head.push(`- **Premise:** ${almanac.opening.premise}`)
    if (almanac.opening.incitingIncident) head.push(`- **Opening Situation (Session 1):** ${almanac.opening.incitingIncident}`)
    if (almanac.opening.startingWhere) head.push(`- **Starting Location:** ${almanac.opening.startingWhere}`)
    if (almanac.opening.tone) head.push(`- **Tone & Stakes:** ${almanac.opening.tone}`)
  }

  if (activeThreads.length) {
    head.push('\n## Active Threads')
    for (const t of activeThreads) {
      head.push(`- [${t.kind ?? 'arc'} · ${t.status ?? 'active'}] ${t.text}${t.where ? ` (${t.where})` : ''}${t.detail ? ` — ${t.detail}` : ''}`)
    }
  }

  head.push(`\n## World-Time Chronicle (${filtered.length} of ${almanac.entries.length} entries)`)
  if (!filtered.length) {
    head.push('(No entries recorded yet.)')
  } else {
    for (const e of filtered) {
      const bits = [
        `Day ${e.when.day} ${padClock(e.when.hour)}:${padClock(e.when.minute)} #${e.when.seq}`,
        e.messages?.length ? 'Archived Chat' : e.tags?.length ? e.tags.map((t) => `#${t}`).join(' ') : null,
        e.where || null,
        e.who.length ? e.who.join(', ') : null
      ].filter(Boolean)
      head.push(
        `- **[${bits.join(' · ')}] ${e.title}** (id: \`${e.id}\`${e.messages?.length ? `, ${e.messages.length} archived turns` : ''}): ${e.summary}${e.outcome ? ` *Outcome:* ${e.outcome}` : ''}${showSecrets && e.secret ? ` *[Secret: ${e.secret}]*` : ''}`
      )
    }
  }
  return head.join('\n')
}

const LEAD_KIND_WEIGHT: Record<string, number> = {
  milestone: 4,
  world: 3,
  combat: 3,
  scene: 2,
  travel: 1,
  chat: 1
}

/** Deterministically builds a public BroadsheetEdition for a day range without requiring an agent. */
export function buildBroadsheetEdition(
  almanac: Almanac,
  opts: { dayFrom: number; dayTo: number; editionNumber?: number; title?: string; masthead?: string }
): BroadsheetEdition {
  const dayFrom = Math.max(1, Math.floor(Math.min(opts.dayFrom, opts.dayTo)))
  const dayTo = Math.max(dayFrom, Math.floor(Math.max(opts.dayFrom, opts.dayTo)))
  const existingMax = (almanac.editions ?? []).reduce((m, e) => Math.max(m, e.editionNumber), 0)
  const editionNumber = opts.editionNumber ?? existingMax + 1

  const inRange = sortAlmanacEntries(almanac.entries, 'newest').filter(
    (e) => e.when.day >= dayFrom && e.when.day <= dayTo
  )

  const toDispatch = (e: AlmanacEntry, isLead = false): BroadsheetDispatch => {
    const kickerParts = [
      `Day ${e.when.day} · ${padClock(e.when.hour)}:${padClock(e.when.minute)}`,
      e.where || null,
      e.kind && e.kind !== 'scene' ? e.kind.toUpperCase() : null
    ].filter(Boolean)
    return {
      id: e.id,
      headline: e.title,
      kicker: kickerParts.join(' · '),
      body: e.summary || e.notes || '(No public summary recorded.)',
      ...(e.outcome ? { outcome: e.outcome } : {}),
      ...(e.where ? { where: e.where } : {}),
      who: e.who,
      day: e.when.day,
      ...(isLead ? { isLead: true } : {})
    }
  }

  let lead: BroadsheetDispatch | null = null
  const dispatches: BroadsheetDispatch[] = []

  if (inRange.length > 0) {
    let bestIdx = 0
    let bestScore = -1
    inRange.forEach((e, idx) => {
      const score =
        (e.pinned ? 10 : 0) +
        (LEAD_KIND_WEIGHT[e.kind] ?? 1) +
        Math.min(3, Math.floor((e.summary?.length ?? 0) / 80)) +
        (e.outcome ? 1 : 0)
      if (score > bestScore) {
        bestScore = score
        bestIdx = idx
      }
    })
    lead = toDispatch(inRange[bestIdx], true)
    inRange.forEach((e, idx) => {
      if (idx !== bestIdx) dispatches.push(toDispatch(e, false))
    })
  }

  const places = [...new Set(inRange.map((e) => e.where).filter(Boolean))]
  const figures = [...new Set(inRange.flatMap((e) => e.who).filter(Boolean))]
  const threads = almanac.threads
    .filter((t) => (t.status ?? (t.done ? 'resolved' : 'active')) !== 'resolved')
    .slice(0, 6)
    .map((t) => ({
      text: t.text,
      kind: t.kind ?? 'arc',
      ...(t.where ? { where: t.where } : {}),
      status: t.status ?? 'active'
    }))

  const defaultTitle = dayFrom === dayTo ? `Day ${dayFrom} Edition` : `Days ${dayFrom}–${dayTo} Edition`
  const title = opts.title?.trim() || defaultTitle
  const subtitle =
    inRange.length === 0
      ? `No recorded dispatches for ${dayFrom === dayTo ? `Day ${dayFrom}` : `Days ${dayFrom}–${dayTo}`}`
      : `${inRange.length} dispatch${inRange.length === 1 ? '' : 'es'}${places.length ? ` · ${places.length} location${places.length === 1 ? '' : 's'}` : ''}${figures.length ? ` · ${figures.length} figure${figures.length === 1 ? '' : 's'}` : ''}`

  return {
    id: `ed_${Date.now().toString(36)}`,
    editionNumber,
    title,
    subtitle,
    dayFrom,
    dayTo,
    createdAt: Date.now(),
    lead,
    dispatches,
    threads,
    places,
    figures,
    ...(opts.masthead?.trim() ? { masthead: opts.masthead.trim() } : {})
  }
}

export function broadsheetEditionMarkdown(almanac: Almanac, edition: BroadsheetEdition): string {
  const lines: string[] = [
    `# ${edition.masthead || `${almanac.title} — Broadsheet`}`,
    `**Edition No. ${edition.editionNumber}** · ${edition.title}${edition.subtitle ? ` (${edition.subtitle})` : ''}`,
    ''
  ]
  if (edition.lead) {
    lines.push(`## ${edition.lead.headline}`)
    if (edition.lead.kicker) lines.push(`*${edition.lead.kicker}*`)
    lines.push(edition.lead.body)
    if (edition.lead.outcome) lines.push(`> **Outcome:** ${edition.lead.outcome}`)
    lines.push('')
  }
  if (edition.dispatches.length) {
    lines.push('## Dispatches')
    for (const d of edition.dispatches) {
      lines.push(`### ${d.headline}`)
      if (d.kicker) lines.push(`*${d.kicker}*`)
      lines.push(d.body)
      if (d.outcome) lines.push(`*Outcome: ${d.outcome}*`)
      lines.push('')
    }
  }
  if (edition.threads.length) {
    lines.push('## Word on the Street')
    for (const t of edition.threads) {
      lines.push(`- [${t.kind}] ${t.text}${t.where ? ` (${t.where})` : ''}`)
    }
  }
  return lines.join('\n')
}
