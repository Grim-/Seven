import { layerOn, mapThingKey, mapThingOf, PROP_THING, TRIGGER_THING, type WorldMapUse } from '@shared/maps'
import { placedKey, type PlacedRef } from '@shared/effects'
import { saveInPlay } from '../../worlds/playLayer'
import { worlds } from '../../worlds/store'
import { registerWorldAct } from '../acts'
import { placedThing } from '../placed'
import { signalPlaced } from '../run'

function placedOf(key: string): PlacedRef | null {
  const rest = key.startsWith('placed:') ? key.slice('placed:'.length) : ''
  const at = rest.indexOf(':')
  return at > 0 ? { map: rest.slice(0, at), id: rest.slice(at + 1) } : null
}

function thingOfPlaced(use: WorldMapUse, id: string): string {
  return mapThingKey((use.triggers ?? []).some((t) => t.id === id) ? TRIGGER_THING : PROP_THING, id)
}

function deliver(world: string, from: PlacedRef, event: string, path: string[]): string[] {
  const use = worlds.mapUses(world).find((u) => u.map === from.map)
  if (!use) return []
  const flags = saveInPlay(world, true)?.flags ?? {}
  const source = placedThing(world, from.map, from.id)?.name ?? from.id
  const out: string[] = []
  for (const link of (use.links ?? []).filter((l) => l.from === thingOfPlaced(use, from.id))) {
    const at: PlacedRef = { map: from.map, id: mapThingOf(link.to).id }
    const target = placedThing(world, at.map, at.id)
    if (!target || !layerOn(use, link.to, flags)) continue
    const key = placedKey(at)
    if (path.includes(key)) {
      out.push(`Stopped: loop at ${target.name}.`)
      continue
    }
    out.push(`${source} → ${target.name}: ${event}`)
    out.push(...signalPlaced(world, at, event, { linkPath: [...path, key], source: null, target: null }).lines)
  }
  return out
}

registerWorldAct('link_emit', (data, { world, targetKey }) => {
  const from = targetKey ? placedOf(targetKey) : null
  const event = String(data.event ?? '').trim()
  if (!world || !from || !event) return null
  const path = Array.isArray(data.path) ? data.path.map(String) : []
  const lines = deliver(world, from, event, path.includes(targetKey!) ? path : [...path, targetKey!])
  return lines.length ? lines.join('\n') : null
})
