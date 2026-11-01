import { LlamaChatSession } from 'node-llama-cpp'
import type { ReasoningStyle, Thought } from '@shared/types'
import type { ModelHost } from '../model/host'
import type { ModelRegistry } from '../model/registry'
import type { AgentRegistry } from '../agents/registry'
import type { SessionStore } from '../sessions/store'
import { chatWrapperFor, handlesThinking } from '../model/wrappers'
import { promptOptions, thinkingLevel, withThinking } from '../model/params'
import { remoteComplete } from '../model/remote'
import { ToolError } from '../tools/types'
import { minds } from './store'
import { styles } from './styles'

const SIDE_CONTEXT = 4096

let deps: { host: ModelHost; models: ModelRegistry; agents: AgentRegistry; sessions: SessionStore } | null = null

export function setupReasoner(d: { host: ModelHost; models: ModelRegistry; agents: AgentRegistry; sessions: SessionStore }): void {
  deps = d
}

export async function sideText(agentId: string, system: string, prompt: string, maxTokens: number, signal: AbortSignal): Promise<string> {
  if (!deps) throw new Error('Reasoning is not set up')
  const { host, models, agents } = deps
  const agent = agents.getOrDefault(agentId)
  if (agent.modelId && models.isRemote(agent.modelId)) {
    const { text } = await remoteComplete(models.remoteTarget(agent.modelId), system, prompt, { ...promptOptions(withThinking(models.getConfig(agent.modelId), agent.thinking), agent.sampling), maxTokens, signal })
    return text.trim()
  }
  if (!host.isLoaded || !host.loadedId) throw new Error('No model is loaded. Load one in Models, or give this agent a model in Agents.')
  const context = await host.model.createContext({ contextSize: Math.min(SIDE_CONTEXT, host.sequence.context.contextSize), sequences: 1 })
  try {
    const config = withThinking(models.getConfig(host.loadedId), agent.thinking)
    const wrapper = chatWrapperFor(host.model, thinkingLevel(config))
    const chat = new LlamaChatSession({ contextSequence: context.getSequence(), chatWrapper: wrapper, systemPrompt: system })
    const sampling = promptOptions(config, agent.sampling, handlesThinking(wrapper))
    const result = await chat.promptWithMeta(prompt, {
      ...sampling,
      maxTokens,
      budgets: sampling.budgets ?? { thoughtTokens: Math.floor(maxTokens / 2) },
      signal,
      stopOnAbortSignal: true
    })
    return result.responseText.trim()
  } finally {
    await context.dispose()
  }
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
  } catch {
    chosen = null
  }
  const ref = chosen ?? asked ?? agent.reasoningStyle ?? null
  const style = ref ? styles.find(ref) : (styles.list()[0] ?? null)
  if (ref && !style)
    throw new ToolError(
      chosen
        ? `The reasoning style "${ref}" picked for this chat no longer exists. Carry on without the reason tool, and ask the user to pick another style for this chat.`
        : ref === asked
          ? `There is no reasoning style "${ref}". Call reason again with style ${styleNames() ? `set to one of: ${styleNames()}, or ` : ''}null for yours.`
          : `Your reasoning style "${ref}" no longer exists. ${styleNames() ? `Call reason again with style set to one of: ${styleNames()}, and` : 'Carry on without the reason tool, and'} ask the user to pick a new style for you in Agents.`
    )
  return style
}

export function styleBrief(style: ReasoningStyle | null): string {
  const voices = style?.voices.length ? `\nVoices in the room:\n${style.voices.map((v) => `- ${v.label}: ${v.line}`).join('\n')}` : ''
  return `${style ? `Style: ${style.name}. ` : ''}${style?.instruction ?? 'Think it through step by step, then decide.'}${voices}`
}

export function reason(input: { agentId: string; sessionId: string | null; question: string; reasoning: string; conclusion: string; style: ReasoningStyle | null }): Thought {
  return minds.think(input.agentId, { sessionId: input.sessionId, kind: 'reason', style: input.style?.name ?? null, question: input.question, reasoning: input.reasoning, conclusion: input.conclusion })
}
