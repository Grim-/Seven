import type { MapData, MapListing, WorldMapUse } from '@shared/maps'
import { worlds } from '../worlds/store'
import { maps } from './store'

export function mapListing(): MapListing[] {
  const all = worlds.list()
  return maps.list().map((m) => ({ ...m, usedBy: all.filter((w) => worlds.mapUses(w.id).some((u) => u.map === m.id)).map((w) => w.name) }))
}

export function mapWithPlace(world: string, key: string): { map: MapData; use: WorldMapUse } | null {
  for (const use of worlds.mapUses(world)) {
    const map = use.shapes[key] ? maps.get(use.map) : null
    if (map) return { map, use }
  }
  return null
}

export function removeMap(id: string): boolean {
  for (const w of worlds.usingMap(id)) worlds.dropMap(w.id, id)
  return maps.remove(id)
}
