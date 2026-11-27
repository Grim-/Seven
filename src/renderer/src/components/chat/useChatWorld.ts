import type { ChatWorld } from '@shared/types'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'

const NONE: ChatWorld = { world: null, sheets: [] }

export function useChatWorld(sessionId: string | null | undefined): ChatWorld {
  return useLive(() => (sessionId ? engine('sessions.world', { id: sessionId }) : Promise.resolve(NONE)), ['sessions.changed', 'agents.changed', 'worlds.changed', 'saves.changed'], [sessionId]) ?? NONE
}
