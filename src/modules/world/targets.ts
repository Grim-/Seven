import { placedKey } from '@shared/effects'
import { mapObjects } from '@shared/maps'
import { playTargetSources, type PlayTargetCandidate } from '../../engine/cards/targets'
import { maps } from '../../engine/maps/store'
import { saveInPlay } from '../../engine/worlds/playLayer'
import { worlds } from '../../engine/worlds/store'

function worldPlaced(world: string): PlayTargetCandidate[] {
  const out: PlayTargetCandidate[] = []
  for (const use of worlds.mapUses(world)) {
    for (const trig of use.triggers ?? []) {
      const ref = { placed: { map: use.map, id: trig.id } }
      out.push({ id: placedKey(ref.placed), name: trig.name, link: trig.name, ref, sheetId: null, hittable: trig.comps.length > 0 })
    }
    const map = maps.get(use.map)
    if (!map) continue
    for (const obj of mapObjects(map.layers)) {
      if (!obj.name?.trim()) continue
      const ref = { placed: { map: use.map, id: obj.id } }
      out.push({ id: placedKey(ref.placed), name: obj.name, link: obj.name, ref, sheetId: null, hittable: (obj.comps?.length ?? 0) > 0 })
    }
  }
  return out
}

playTargetSources.add({
  id: 'world-targets',
  module: 'world',
  name: 'World targets',
  order: 10,
  list: (ctx) => {
    if (!ctx.world) return []
    const save = saveInPlay(ctx.world, false)
    const creatures: PlayTargetCandidate[] = (save?.creatures ?? []).map((c) => ({
      id: `creature:${c.uid}`,
      name: c.name,
      link: c.name,
      ref: { creature: c.uid },
      sheetId: null,
      hittable: true
    }))
    return [...creatures, ...worldPlaced(ctx.world)]
  }
})
