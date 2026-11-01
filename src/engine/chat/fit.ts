import type { LlamaChatSession } from 'node-llama-cpp'
import type { ToolDef } from '../tools/types'

const REPLY_ROOM = 1024

export function checkFits(chat: LlamaChatSession, systemPrompt: string, prompt: string, tools: ToolDef[]): void {
  const contextSize = chat.sequence.context.contextSize
  const availableFunctions = tools.length
    ? Object.fromEntries(tools.map((t) => [t.name, { description: t.description, params: t.params }]))
    : undefined
  const { contextText } = chat.chatWrapper.generateContextState({
    chatHistory: [...(systemPrompt ? [{ type: 'system' as const, text: systemPrompt }] : []), { type: 'user', text: prompt }, { type: 'model', response: [] }],
    availableFunctions
  })
  const needed = contextText.tokenize(chat.model.tokenizer).length
  const usable = contextSize - Math.max(1, Math.floor(contextSize / 10)) - REPLY_ROOM
  if (needed <= usable) return
  const suggested = Math.ceil(((needed + REPLY_ROOM) * 1.1 + 4096) / 1024) * 1024
  throw new Error(
    `The model's context is ${contextSize.toLocaleString()} tokens, but this agent's instructions${tools.length ? ` and ${tools.length} tools` : ''} plus your message take ${needed.toLocaleString()}, leaving no room for a reply. ` +
      `Raise Context size in Models (${suggested.toLocaleString()} or more) and reload the model${tools.length ? ', or turn off tool groups for this agent' : ''}.`
  )
}

export function readableError(err: unknown, contextSize: number | null): string {
  const text = err instanceof Error ? err.message : String(err)
  if (/context shift strategy|compress chat history|too small to fit the context shift/i.test(text)) {
    return `The conversation no longer fits in the model's context${contextSize ? ` (${contextSize.toLocaleString()} tokens)` : ''}, even after dropping older messages. Raise Context size in Models and reload, or start a new chat.`
  }
  return text
}
