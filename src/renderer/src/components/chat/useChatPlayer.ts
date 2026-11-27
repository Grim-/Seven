import { chatPlayer, type AgentProfile } from '@shared/types'
import { useSessions } from '../../store/sessions'
import { useWorldPlayer } from '../play/useWorldPlayer'

export function useChatPlayer(agent: AgentProfile | null, worldId?: string | null): string | null {
  const sessionWorldId = useSessions((s) => {
    if (!agent) return null
    const matched = s.list
      .filter((x) => x.agentId === agent.id && x.scene?.worldId)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0]
    return matched?.scene?.worldId ?? null
  })
  return chatPlayer(agent, useWorldPlayer(worldId !== undefined ? worldId : sessionWorldId))
}
