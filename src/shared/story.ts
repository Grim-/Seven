import { dayKey } from './timeline'
import { referencePattern } from './text'

export interface StorySession {
  id: string
  date: string
  title: string
  notes: string
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

export function blankStory(): Story {
  return { where: '', threads: [], sessions: [] }
}

export function newSession(date = dayKey(Date.now())): StorySession {
  return { id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date, title: '', notes: '' }
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '')
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object') : [])

function fromOldLog(dnd: Record<string, unknown>): Story {
  const days = new Map<string, string[]>()
  for (const e of list(dnd.log)) {
    const t = text(e.text).trim()
    if (!t) continue
    const date = text(e.date) || dayKey(Date.now())
    days.set(date, [...(days.get(date) ?? []), t])
  }
  return { where: text(dnd.where), threads: [], sessions: [...days].map(([date, lines], i) => ({ id: `old${i}`, date, title: '', notes: lines.join('\n\n') })) }
}

export function cleanStory(raw: unknown, oldDnd?: unknown): Story {
  if (!raw || typeof raw !== 'object') return oldDnd && typeof oldDnd === 'object' ? fromOldLog(oldDnd as Record<string, unknown>) : blankStory()
  const s = raw as Record<string, unknown>
  return {
    where: text(s.where),
    threads: list(s.threads)
      .map((t) => ({ text: text(t.text).trim(), done: t.done === true }))
      .filter((t) => t.text),
    sessions: list(s.sessions).map((x, i) => ({ id: text(x.id) || `s${i}`, date: text(x.date), title: text(x.title), notes: text(x.notes) }))
  }
}

function sessionText(s: StorySession, n: number): string {
  return `### Session ${n}${s.title ? `: ${s.title}` : ''}${s.date ? ` (${s.date})` : ''}\n${s.notes.trim() || 'No notes.'}`
}

export function storyText(story: Story, roleplay = false): string {
  const open = story.threads.filter((t) => !t.done).map((t) => `- ${t.text}`)
  const recent = roleplay ? 1 : 3
  const shown = story.sessions.slice(-recent)
  const earlier = story.sessions.slice(0, -recent)
  const parts = [
    `Now: ${story.where || 'not set'}`,
    open.length ? `Open threads:\n${open.join('\n')}` : '',
    !roleplay && earlier.length ? `Earlier sessions: ${earlier.map((s, i) => `${i + 1}${s.title ? ` ${s.title}` : ''}${s.date ? ` (${s.date})` : ''}`).join('; ')}` : '',
    ...shown.map((s) => sessionText(s, story.sessions.indexOf(s) + 1))
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
    for (const { kind, ref } of refsIn(body)) {
      const key = `${kind}:${ref.toLowerCase()}`
      const hit = found.get(key) ?? { kind, ref, sessions: [] }
      if (session !== null && !hit.sessions.includes(session)) hit.sessions.push(session)
      found.set(key, hit)
    }
  }
  scan(story.where, null)
  story.threads.forEach((t) => scan(t.text, null))
  story.sessions.forEach((s, i) => scan(`${s.title}\n${s.notes}`, i + 1))
  return [...found.values()]
}
