import type { ChatMessage, ContextSummary } from '@shared/types'
import type { ToolDef } from '../tools/types'
import { modules } from '../modules/registry'

export const CHECK_IN = 'check_in'

const LOOKUPS = new Set(['recall', 'find', 'read_kind'])
const REASONING = new Set(['think', 'reason'])

function toolNames(m: ChatMessage): string[] {
  return m.parts.flatMap((p) => (p.type === 'tool' && p.name !== CHECK_IN && p.status === 'done' ? [p.name] : []))
}

function turnsSince(turns: string[][], match: (name: string) => boolean): number | null {
  for (let i = turns.length - 1; i >= 0; i--) if (turns[i].some(match)) return turns.length - 1 - i
  return null
}

export function checkInText(messages: ChatMessage[], tools: ToolDef[], every: number, summary: ContextSummary | null): string | null {
  if (every <= 0) return null
  const replies = messages.filter((m) => m.role === 'assistant')
  if (!replies.length || replies.length % every !== 0) return null
  const turns = replies.map(toolNames)
  const recent = turns.slice(-every)
  const has = (name: string) => tools.some((t) => t.name === name)

  const reminders: string[] = []
  const seen = new Set<string>()
  for (const group of [...new Set(tools.map((t) => t.group))]) {
    const text = modules.remindFor(group)
    if (text && !seen.has(text)) {
      seen.add(text)
      reminders.push(text)
    }
  }

  const facts: string[] = []
  if (has('remember')) {
    const saved = recent.flat().filter((n) => n === 'remember').length
    const since = turnsSince(turns, (n) => n === 'remember')
    if (saved >= 3) facts.push(`You saved ${saved} memories in the last ${every} turns. Only keep what will matter in a future chat.`)
    else if (since === null) facts.push(`You haven't saved a memory in this chat yet (${turns.length} turns).`)
    else if (since >= every) facts.push(`You last saved a memory ${since} turns ago.`)
  }
  if ([...LOOKUPS].some(has)) {
    const since = turnsSince(turns, (n) => LOOKUPS.has(n))
    if (since === null)
      facts.push(`You haven't looked anything up in your memory or the library in this chat yet (${turns.length} turns).`)
    else if (since >= every)
      facts.push(`You haven't looked anything up in your memory or the library in ${since} turns.`)
  }
  if ([...REASONING].some(has) && !recent.flat().some((n) => REASONING.has(n))) facts.push(`You didn't think or reason in any of the last ${every} turns.`)
  const counts = new Map<string, number>()

  for (const name of recent.flat())
    counts.set(name, (counts.get(name) ?? 0) + 1)

  if (counts.size)
    facts.push(`In the last ${every} turns you used: ${[...counts.entries()].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(', ')}.`)
  else facts.push(`You used no tools in the last ${every} turns.`)
  if (summary) {
    const at = messages.findIndex((m) => m.id === summary.upTo)
    const after = at < 0 ? null : messages.slice(at).filter((m) => m.role === 'assistant').length
    if (after !== null && after <= every)
      facts.push('This chat was summarised recently; anything from before the summary is only in the summary now.')
  }

  return [`[IMPORTANT AGENT NOTICE Check-in..]`, ...reminders, facts.map((f) => `- ${f}`).join('\n')].filter(Boolean).join('\n\n')
}
