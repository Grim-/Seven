import { draftOf, useSessions, type ChatDraft } from '../store/sessions'
import { useAgentIdOf, useConversation } from './conversation'
import { useAgents } from '../store/agents'
import { engine } from './ipc'
import { failed } from './notify'
import type { AgentProfile, SessionMeta, ThinkingLevel, ToolChoiceMode } from '@shared/types'

interface Override<T> {
  meta: (m: SessionMeta) => T | null | undefined
  draft: (d: ChatDraft) => T | null
  save: (id: string, value: T | null) => Promise<unknown>
  setDraft: (key: string, value: T | null) => void
  what: string
}

export function useChatOverride<T>(o: Override<T>): { agent: AgentProfile | undefined; value: T | null; ready: boolean; set: (value: T | null) => void } {
  const conv = useConversation()
  const activeId = conv.sessionId
  const meta = useSessions((s) => s.list.find((x) => x.id === activeId))
  const draftValue = useSessions((s) => o.draft(draftOf(s, conv.key)))
  const agentId = useAgentIdOf(conv)
  const agent = useAgents((s) => s.list.find((a) => a.id === agentId))
  const value = (activeId ? (meta ? o.meta(meta) : null) : draftValue) ?? null
  const set = (v: T | null) => (activeId ? void o.save(activeId, v).catch(failed(`Could not change the ${o.what}`)) : o.setDraft(conv.key, v))
  return { agent, value, ready: !activeId || Boolean(meta), set }
}

export const STYLE_OVERRIDE: Override<string> = {
  meta: (m) => m.reasoningStyle,
  draft: (d) => d.style,
  save: (id, style) => engine('sessions.setStyle', { id, style }),
  setDraft: (key, style) => useSessions.getState().setDraftStyle(key, style),
  what: 'reasoning style'
}

export const THINKING_OVERRIDE: Override<ThinkingLevel> = {
  meta: (m) => m.thinking,
  draft: (d) => d.thinking,
  save: (id, thinking) => engine('sessions.setThinking', { id, thinking }),
  setDraft: (key, thinking) => useSessions.getState().setDraftThinking(key, thinking),
  what: 'thinking level'
}

export const TOOL_CHOICE_OVERRIDE: Override<ToolChoiceMode> = {
  meta: (m) => m.toolChoice,
  draft: (d) => d.toolChoice,
  save: (id, toolChoice) => engine('sessions.setToolChoice', { id, toolChoice }),
  setDraft: (key, toolChoice) => useSessions.getState().setDraftToolChoice(key, toolChoice),
  what: 'tool execution mode'
}
