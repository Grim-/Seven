import { mapObjects } from '@shared/maps'
import type { ComponentDef } from '@shared/game/core'
import { maps } from '../maps/store'
import { worlds } from '../worlds/store'

export interface PlacedThing {
  name: string
  comps: ComponentDef[]
}

export function placedThing(world: string, map: string, id: string): PlacedThing | null {
  const trigger = worlds.mapUses(world).find((u) => u.map === map)?.triggers?.find((t) => t.id === id)
  if (trigger) return { name: trigger.name, comps: trigger.comps }
  const data = maps.get(map)
  const object = data ? mapObjects(data.layers).find((o) => o.id === id) : undefined
  return object ? { name: object.name, comps: object.comps ?? [] } : null
}
