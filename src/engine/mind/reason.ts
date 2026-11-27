import { noteFailure } from '../util/report'
import { agentSheets, type ReasoningStyle, type Thought } from '@shared/types'
import { characterMindFor } from '../library/sheets'
import type { ModelHost } from '../model/host'
import type { ModelRegistry } from '../model/registry'
import type { AgentRegistry } from '../agents/registry'
import type { SessionStore } from '../sessions/store'
import { ToolError } from '../tools/types'
import { minds } from './store'
import { styles } from './styles'

let deps: { host: ModelHost; models: ModelRegistry; agents: AgentRegistry; sessions: SessionStore } | null = null

export function setupReasoner(d: { host: ModelHost; models: ModelRegistry; agents: AgentRegistry; sessions: SessionStore }): void {
  deps = d
}

export function styleNames(): string {
  return styles
    .list()
    .map((s) => s.name)
    .join(', ')
}

export function styleFor(agentId: string, sessionId: string | null, asked: string | null): ReasoningStyle | null {
  if (!deps) return styles.list()[0] ?? null
  const agent = deps.agents.getOrDefault(agentId)
  let chosen: string | null = null
  try {
    chosen = sessionId ? (deps.sessions.get(sessionId).reasoningStyle ?? null) : null
  } catch (err) {
    noteFailure(err, 'memory', "Could not read the chat's reasoning style")
    chosen = null
  }
  const sheetStyle = characterMindFor(agentSheets(agent))?.reasoningStyle ?? null
  const ref = chosen ?? sheetStyle ?? agent.reasoningStyle ?? asked ?? null
  const style = ref ? styles.find(ref) : (styles.list()[0] ?? null)
  if (ref && !style)
    throw new ToolError(
      chosen
        ? `The reasoning style "${ref}" picked for this chat no longer exists. Carry on without the reason tool, and ask the user to pick another style (${styleNames()}) for this chat.`
        : ref === asked
          ? `There is no reasoning style "${ref}". Call reason again with style ${styleNames() ? `set to one of: ${styleNames()}, or ` : ''}null for yours.`
          : `Your reasoning style "${ref}" no longer exists. ${styleNames() ? `Call reason again with style set to one of: ${styleNames()}, and` : 'Carry on without the reason tool, and'} ask the user to pick a new style for you in Agents.`
    )
  return style
}

export function styleBrief(style: ReasoningStyle | null): string {
  const voices = style?.voices.length ? `\nVoices in the room:\n${style.voices.map((v) => `- ${v.label}: ${v.line}`).join('\n')}` : ''
  const constraints = style?.constraints?.trim() ? `\nOutput & voice constraints (filter your conclusion and reply strictly through these):\n${style.constraints.trim()}` : ''
  return `${style ? `Style: ${style.name}. ` : ''}${style?.instruction ?? 'Think it through step by step, then decide.'}${voices}${constraints}`
}

export function reason(input: { agentId: string; sessionId: string | null; question: string; reasoning: string; conclusion: string; style: ReasoningStyle | null }): Thought {
  return minds.think(input.agentId, { sessionId: input.sessionId, kind: 'reason', style: input.style?.name ?? null, question: input.question, reasoning: input.reasoning, conclusion: input.conclusion })
}
