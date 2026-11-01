import type { PlaceVisitor } from '@shared/maps'
import { engine } from '../../lib/ipc'
import { useLibraryData } from '../../lib/useLive'

export function usePresenceData(world: string): Record<string, PlaceVisitor[]> | null {
  return useLibraryData(
    () => engine('places.here', { world }).catch(() => ({})),
    `places.here.${world}`
  )
}

export function usePresence(world: string): Record<string, PlaceVisitor[]> {
  return usePresenceData(world) ?? {}
}
