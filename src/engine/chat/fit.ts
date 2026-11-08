import type { ToolDef } from '../tools/types'
import { estimateTokens } from '../tools/budget'

const REPLY_ROOM = 1024

export function checkFits(contextSize: number, systemPrompt: string, prompt: string, tools: ToolDef[]): void {
  const functions = tools.length ? JSON.stringify(tools.map((t) => ({ name: t.name, description: t.description, params: t.params }))) : ''
  const needed = estimateTokens(systemPrompt + prompt + functions)
  const usable = contextSize - Math.max(1, Math.floor(contextSize / 10)) - REPLY_ROOM
  if (needed <= usable) return
  const suggested = Math.ceil(((needed + REPLY_ROOM) * 1.1 + 4096) / 1024) * 1024
  throw new Error(
    `The model's context is ${contextSize.toLocaleString()} tokens, but this agent's instructions${tools.length ? ` and ${tools.length} tools` : ''} plus your message take about ${needed.toLocaleString()}, leaving no room for a reply. ` +
      `Raise Context size in Models (${suggested.toLocaleString()} or more) and reload the model${tools.length ? ', or turn off tool groups for this agent' : ''}.`
  )
}
