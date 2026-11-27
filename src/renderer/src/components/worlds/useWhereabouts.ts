import type { Destination, Whereabouts } from '@shared/whereabouts'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'

export function useWhereabouts(sheet: string): Whereabouts | null {
  return useLive(() => engine('worlds.whereabouts', { sheet }), ['worlds.changed', 'saves.changed', 'npcs.changed'], [sheet])
}

export function useDestinations(): Destination[] {
  return useLive(() => engine('worlds.destinations'), ['worlds.changed', 'maps.changed'], []) ?? []
}
