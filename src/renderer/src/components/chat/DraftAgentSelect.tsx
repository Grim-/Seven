import { AgentSelect } from '../agents/AgentSelect'
import { useAgents } from '../../store/agents'
import { useSessions } from '../../store/sessions'
import type { Conversation } from '../../lib/conversation'

export function DraftAgentSelect({ conv, agentId, className }: { conv: Conversation; agentId: string | null; className?: string }) {
  const any = useAgents((s) => s.list.length > 0)
  if (!any) return null
  return <AgentSelect value={agentId} onChange={(v) => useSessions.getState().setDraftAgent(conv.key, v)} className={className ?? 'h-7 text-[12px]'} />
}
