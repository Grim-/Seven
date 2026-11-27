import type { ResolvedWorldEvent } from '@shared/game/worldEvents'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'

export function useWorldEvents(worldId: string | null): ResolvedWorldEvent[] {
  return useLive(() => (worldId ? engine('worldEvents.list', { worldId }) : Promise.resolve([])), 'worldEvents.changed', [worldId]) ?? []
}

export function useWorldEvent(eventId: string, worldId: string | null): ResolvedWorldEvent | null {
  return useLive(() => engine('worldEvents.get', { id: eventId, worldId }), ['worldEvents.changed', 'saves.changed'], [eventId, worldId])
}

export const isWaiting = (e: ResolvedWorldEvent): boolean => e.status === 'active' && !e.resolution
