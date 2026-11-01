import fs from 'node:fs'
import type { ChatHistoryItem } from 'node-llama-cpp'
import type { ChatMessage, ContextSummary, ToolPart } from '@shared/types'
import { NEXT_TURN, groupTurns, pairCalls, toolParts, turnItems, type FitResult, type TurnGroup } from './history'
import { outputFile } from '../tools/budget'
import { writeText } from '../util/fs'

export const MIN_TRIM_TOKENS = 150

export interface TrimPlan {
  parts: { part: ToolPart; tokens: number; text: string }[]
  messages: ChatMessage[]
}

export function turnsInView(messages: ChatMessage[], summary: ContextSummary | null): TurnGroup[] {
  const turns = groupTurns(messages)
  if (!summary) return turns
  if (summary.upTo === NEXT_TURN) return []
  const start = turns.findIndex((t) => t.user.id === summary.upTo)
  return start > -1 ? turns.slice(start) : turns
}

export function planTrim(
  messages: ChatMessage[],
  slices: Map<string, ChatHistoryItem[]>,
  summary: ContextSummary | null,
  keepTurns: number,
  count: (text: string) => number,
  fit?: FitResult
): TrimPlan {
  const turns = turnsInView(messages, summary)
  const old = turns.slice(0, Math.max(0, turns.length - keepTurns))
  const parts: TrimPlan['parts'] = []
  for (const turn of old) {
    for (const [call, part] of pairCalls(turnItems(turn, slices, fit), toolParts(turn))) {
      if (part.trimmed || part.status !== 'done') continue
      const text = typeof call.result === 'string' ? call.result : JSON.stringify(call.result ?? '')
      const tokens = count(text)
      if (tokens >= MIN_TRIM_TOKENS) parts.push({ part, tokens, text })
    }
  }
  const changed = new Set(parts.map((p) => p.part.id))
  const touched = messages.filter((m) => m.parts.some((p) => p.type === 'tool' && changed.has(p.id)))
  return { parts, messages: touched }
}

export function applyTrim(plan: TrimPlan, outputsDir: string): ChatMessage[] {
  fs.mkdirSync(outputsDir, { recursive: true })
  const byId = new Map(plan.parts.map((p) => [p.part.id, p]))
  for (const { part, text } of plan.parts) {
    const file = outputFile(outputsDir, part.id)
    if (!fs.existsSync(file)) writeText(file, text)
  }
  return plan.messages.map((m) => ({
    ...m,
    parts: m.parts.map((p) => (p.type === 'tool' && byId.has(p.id) ? { ...p, trimmed: Math.max(1, byId.get(p.id)!.tokens) } : p))
  }))
}

export interface SummaryPlan {
  upTo: string
  turns: number
  before: ChatMessage[]
}

export function planSummary(messages: ChatMessage[], summary: ContextSummary | null, keepTurns: number): SummaryPlan | null {
  const turns = turnsInView(messages, summary)
  let cut = turns.length - Math.max(1, keepTurns)
  if (cut < 1) cut = turns.length - 1
  if (cut < 1) return null
  const boundary = turns[cut].user
  return {
    upTo: boundary.id,
    turns: cut + (summary?.turns ?? 0),
    before: messages.filter((m) => m.createdAt < boundary.createdAt)
  }
}

export function summaryRequest(maxWords: number): string {
  return [
    '[Seven: this conversation is getting too long for your context window. Write a summary of everything above so it can replace the older messages.',
    "Keep the user's goals and requests, decisions made, important facts, names, file paths, ids and numbers, what was done, and what is still open.",
    'Leave out small talk and tool output details that no longer matter.',
    `Write plain notes, at most about ${maxWords} words. Do not call any tools. Reply with the summary only.]`
  ].join(' ')
}

export function handoffRequest(maxWords: number): string {
  return [
    '[Seven: the user is moving this conversation to a new chat. Write a handoff note so the new chat can pick up from here without starting from scratch.',
    'Cover who (the people, characters or agents involved), what (what is being worked on, decisions made, important facts, names, ids and numbers), where (where things stand right now: entries, files, places in a story), why (the goals behind it), and what is still open or next.',
    `Write plain notes under those headings, at most about ${maxWords} words. Do not call any tools. Reply with the note only.]`
  ].join(' ')
}

export const TOOLS_OFF = 'Tools are not available while writing the summary. Write the summary now, as plain text.'

export const SHIFT_NOTICE =
  "This chat no longer fit in the model's context, so the oldest messages were dropped for this reply. Use Compact to keep them as a summary instead."
