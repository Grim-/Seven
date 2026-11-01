import type { PlaceVisitor } from '@shared/maps'
import { PLACE_TYPE_KEY, type WorldChanges, type WorldEntity } from '@shared/world'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { usePresenceData } from './usePresence'

const records = (world: string) =>
  engine('worlds.records', { id: world, type: PLACE_TYPE_KEY }).catch(() => ({}))
const changes = (world: string) =>
  engine('worlds.changes', { id: world, type: PLACE_TYPE_KEY }).catch(() => ({}))

export function usePlaceRecords(world: string): Record<string, WorldEntity> {
  return useLive(() => records(world), 'worlds.changed') ?? {}
}

export interface PlaceData {
  places: Record<string, WorldEntity>
  changes: Record<string, WorldChanges>
  here: Record<string, PlaceVisitor[]>
}

export function usePlaceData(world: string): PlaceData | null {
  const places = useLive(() => records(world), 'worlds.changed')
  const changed = useLive(() => changes(world), 'worlds.changed')
  const here = usePresenceData(world)
  return places && changed && here ? { places, changes: changed, here } : null
}
