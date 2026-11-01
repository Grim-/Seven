import type { MapData, WorldMapUse } from '@shared/maps'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'

export function useMap(id: string): MapData | false | null {
  return useLive(() => engine('maps.get', { id }).then((m) => m ?? false), 'maps.changed')
}

export function useWorldMaps(world: string): WorldMapUse[] | null {
  return useLive(() => engine('worlds.maps', { id: world }).catch(() => []), 'worlds.changed')
}
