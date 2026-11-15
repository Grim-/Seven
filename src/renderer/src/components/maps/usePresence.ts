import type { PlaceVisitor } from '@shared/maps'
import { engine } from '../../lib/ipc'
import { useLibraryData } from '../../lib/useLive'
import { noteFailure } from '../../store/problems'

export function usePresenceData(world: string): Record<string, PlaceVisitor[]> | null {
  return useLibraryData(
    () => engine('places.here', { world }).catch(noteFailure('maps', 'Could not load who is here', () => ({}))),
    `places.here.${world}`
  )
}

export function usePresence(world: string): Record<string, PlaceVisitor[]> {
  return usePresenceData(world) ?? {}
}
