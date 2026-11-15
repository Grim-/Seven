import type { MapData, WorldMapUse } from '@shared/maps'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { noteFailure } from '../../store/problems'

export function useMap(id: string): MapData | false | null {
  return useLive(() => engine('maps.get', { id }).then((m) => m ?? false), 'maps.changed', [id])
}

export function useWorldMaps(world: string): WorldMapUse[] | null {
  return useLive(() => engine('worlds.maps', { id: world }).catch(noteFailure('maps', 'Could not load the world maps', () => [])), 'worlds.changed', [world])
}
