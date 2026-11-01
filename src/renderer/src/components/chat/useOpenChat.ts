import type { AgentProfile, SessionMeta } from '@shared/types'
import { useSessions } from '../../store/sessions'
import { useAgents } from '../../store/agents'
import { useModels } from '../../store/models'
import { useAgentIdOf, useConversation, useLoadConversation, type Conversation } from '../../lib/conversation'

export interface OpenChat {
  conv: Conversation
  active: SessionMeta | null
  agent: AgentProfile | null
  agentId: string | null
  running: boolean
  loading: boolean
  hasModel: boolean
}

export function useOpenChat(): OpenChat {
  const conv = useConversation()
  useLoadConversation()
  const activeId = conv.sessionId
  const active = useSessions((s) => (activeId ? (s.list.find((x) => x.id === activeId) ?? null) : null))
  const running = useSessions((s) => (activeId ? s.running[activeId] === true : false))
  const agents = useAgents((s) => s.list)
  const host = useModels((s) => s.host)
  const agentId = useAgentIdOf(conv)
  const agent = agents.find((a) => a.id === agentId) ?? agents[0] ?? null
  return { conv, active, agent, agentId, running, loading: host.status === 'loading', hasModel: Boolean(agent?.modelId ?? host.modelId) }
}

export function threadProps(chat: OpenChat, noModel: string) {
  const name = chat.agent?.name ?? 'Seven'
  return {
    agent: chat.agent,
    agentName: name,
    running: chat.running,
    emptyTitle: chat.active ? 'Awaiting input' : 'New session',
    emptyBody: chat.hasModel ? `Start typing to chat with ${name}.` : noModel,
    placeholder: `Message ${name}...`
  }
}
