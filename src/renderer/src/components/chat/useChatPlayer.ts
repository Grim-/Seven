import { chatPlayer, type AgentProfile } from '@shared/types'
import { useWorldPlayer } from '../play/useWorldPlayer'

export function useChatPlayer(agent: AgentProfile | null): string | null {
  return chatPlayer(agent, useWorldPlayer(agent?.world?.worldId ?? null))
}
