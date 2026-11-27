import type { PlaceVisitor } from '@shared/maps'
import { PLACE_TYPE_KEY, REGION_TYPE_KEY, type WorldChanges, type WorldEntity } from '@shared/world'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { usePresenceData } from './usePresence'
import { noteFailure } from '../../store/problems'

export type WorldLayer = 'template' | 'play'

const records = (world: string, type: string, layer: WorldLayer = 'play') =>
  engine('worlds.records', { id: world, type, layer }).catch(noteFailure('maps', `Could not load ${type}s`, () => ({})))
const changes = (world: string, layer: WorldLayer = 'play') =>
  engine('worlds.changes', { id: world, type: PLACE_TYPE_KEY, layer }).catch(noteFailure('maps', 'Could not load the place changes', () => ({})))

export function usePlaceRecords(world: string): Record<string, WorldEntity> {
  return useLive(() => records(world, PLACE_TYPE_KEY), 'worlds.changed') ?? {}
}

export function useRegionRecords(world: string): Record<string, WorldEntity> {
  return useLive(() => records(world, REGION_TYPE_KEY), 'worlds.changed') ?? {}
}

export interface PlaceData {
  places: Record<string, WorldEntity>
  changes: Record<string, WorldChanges>
  here: Record<string, PlaceVisitor[]>
}

export function usePlaceData(world: string, layer: WorldLayer = 'play'): PlaceData | null {
  const places = useLive(() => records(world, PLACE_TYPE_KEY, layer), 'worlds.changed')
  const changed = useLive(() => changes(world, layer), 'worlds.changed')
  const here = usePresenceData(world)
  return places && changed && here ? { places, changes: changed, here } : null
}
