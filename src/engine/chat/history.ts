import type { ChatHistoryItem, FunctionCallItem as ChatModelFunctionCall, ModelItem as ChatModelResponse } from './items'
import type { ChatMessage, ContextSummary, ToolPart } from '@shared/types'

export interface TurnGroup {
  user: ChatMessage
  replies: ChatMessage[]
}

export function groupTurns(messages: ChatMessage[]): TurnGroup[] {
  const turns: TurnGroup[] = []
  for (const message of messages) {
    if (message.role === 'user') turns.push({ user: message, replies: [] })
    else if (turns.length) turns[turns.length - 1].replies.push(message)
  }
  return turns
}

export function toolParts(turn: TurnGroup): ToolPart[] {
  return turn.replies.flatMap((m) => m.parts.filter((p): p is ToolPart => p.type === 'tool'))
}

function userText(message: ChatMessage): string {
  return message.modelText ?? message.parts.map((p) => (p.type === 'text' ? p.text : '')).join('')
}

export function modelResultOf(part: ToolPart): string {
  if (part.status === 'done') return part.result ?? ''
  if (part.status === 'cancelled') return 'The user cancelled this.'
  if (part.status === 'blocked') return `Blocked: ${part.error ?? ''}`
  return `Error: ${part.error ?? ''}`
}

export type FitResult = (part: ToolPart, text: string) => string

export type ImagesOf = (user: ChatMessage) => string[]

export function imageItem(images: string[]): ChatHistoryItem {
  return { type: 'user', text: '', images } as ChatHistoryItem
}

export function imagesIn(item: ChatHistoryItem): string[] {
  const images = (item as { images?: unknown }).images
  return Array.isArray(images) ? images.filter((i): i is string => typeof i === 'string') : []
}

function synthesize(turn: TurnGroup, fit?: FitResult, imagesOf?: ImagesOf): ChatHistoryItem[] {
  const images = imagesOf?.(turn.user) ?? []
  const items: ChatHistoryItem[] = [{ type: 'user', text: userText(turn.user), ...(images.length ? { images } : {}) } as ChatHistoryItem]
  let response: ChatModelResponse['response'] = []
  for (const reply of turn.replies) {
    for (const part of reply.parts) {
      if (part.type === 'thought') response.push({ type: 'segment', segmentType: 'thought', text: part.text, ended: true })
      else if (part.type === 'text') response.push(part.text)
      else if (part.status !== 'running') {
        const result = modelResultOf(part)
        response.push({ type: 'functionCall', name: part.name, params: part.args, result: fit && part.status === 'done' ? fit(part, result) : result })
        if (part.images?.length && imagesOf) {
          items.push({ type: 'model', response }, imageItem(part.images))
          response = []
        }
      }
    }
  }
  items.push({ type: 'model', response })
  return items
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function calls(items: ChatHistoryItem[]): ChatModelFunctionCall[] {
  return items.flatMap((item) => (item.type === 'model' ? item.response.filter((r): r is ChatModelFunctionCall => typeof r !== 'string' && r.type === 'functionCall') : []))
}

export function pairCalls(items: ChatHistoryItem[], parts: ToolPart[]): [ChatModelFunctionCall, ToolPart][] {
  const pairs: [ChatModelFunctionCall, ToolPart][] = []
  let next = 0
  for (const call of calls(items)) {
    const index = parts.findIndex((p, i) => i >= next && p.name === call.name)
    if (index === -1) continue
    pairs.push([call, parts[index]])
    next = index + 1
  }
  return pairs
}

export function trimStub(part: ToolPart): string {
  const size = part.trimmed && part.trimmed > 1 ? ` (about ${part.trimmed.toLocaleString()} tokens)` : ''
  return `[The output of this ${part.name} call${size} was removed from the conversation to save space. read_kind(result, ${part.id}, false) gives it again.]`
}

export function summaryBlock(summary: ContextSummary): string {
  return `[Summary of the earlier part of this conversation. The older messages were removed to save space.]\n${summary.text.trim()}\n[End of summary]`
}

export const NEXT_TURN = 'next'

export function activeSummary(summaries: ContextSummary[], messages: ChatMessage[]): ContextSummary | null {
  const ids = new Set(messages.filter((m) => m.role === 'user').map((m) => m.id))
  for (let i = summaries.length - 1; i >= 0; i--) if (summaries[i].upTo === NEXT_TURN || ids.has(summaries[i].upTo)) return summaries[i]
  return null
}

export interface RebuildInput {
  systemPrompt: string
  messages: ChatMessage[]
  slices: Map<string, ChatHistoryItem[]>
  summary: ContextSummary | null
  fit?: FitResult
  imagesOf?: ImagesOf
}

export function turnItems(turn: TurnGroup, slices: Map<string, ChatHistoryItem[]>, fit?: FitResult, imagesOf?: ImagesOf): ChatHistoryItem[] {
  const slice = turn.replies.length === 1 && !turn.replies[0].edited ? slices.get(turn.replies[0].id) : undefined
  return slice && slice[0]?.type === 'user' ? clone(slice) : synthesize(turn, fit, imagesOf)
}

export function rebuildHistory({ systemPrompt, messages, slices, summary, fit, imagesOf }: RebuildInput): ChatHistoryItem[] {
  let turns = groupTurns(messages)
  if (summary) {
    const start = summary.upTo === NEXT_TURN ? turns.length : turns.findIndex((t) => t.user.id === summary.upTo)
    if (start > -1) turns = turns.slice(start)
  }
  const history: ChatHistoryItem[] = systemPrompt ? [{ type: 'system', text: systemPrompt }] : []
  turns.forEach((turn, index) => {
    const items = turnItems(turn, slices, fit, imagesOf)
    for (const [call, part] of pairCalls(items, toolParts(turn))) {
      if (part.trimmed) call.result = trimStub(part)
      else if (part.edited) call.result = part.result ?? ''
    }
    if (index === 0 && summary && turn.user.id === summary.upTo) {
      const user = items.find((i) => i.type === 'user')
      const block = summaryBlock(summary)
      if (user && user.type === 'user' && !user.text.startsWith(block)) user.text = `${block}\n\n${user.text}`
    }
    history.push(...items)
  })
  return history
}

export function isValidHistory(value: unknown): value is ChatHistoryItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        ((item.type === 'system' && item.text !== undefined) ||
          (item.type === 'user' && typeof item.text === 'string') ||
          (item.type === 'model' && Array.isArray(item.response)))
    )
  )
}
