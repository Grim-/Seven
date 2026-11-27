import { worldId, PLACE_TYPE_KEY, REGION_TYPE_KEY, type WorldBinding } from '@shared/world'
import { npcActorId, splitNpcRef } from '@shared/worldNpcs'
import { placeBreadcrumbNames, placePath, placesIn, type Standing } from '@shared/maps'
import { smallestAt } from '@shared/shapes'
import { GameClock } from '@shared/game/core/clock'
import type { GameSave } from '@shared/game/save'
import type { Destination, Whereabouts } from '@shared/whereabouts'
import { findSheet, getSheet, setGame } from '../library/sheets'
import { maps } from '../maps/store'
import { defaultCharacterGameRecord } from './defaultGame'
import { npcs } from './npcs'
import { saveInPlay } from './playLayer'
import { WorldError, worlds } from './store'
import { worldsOfSheet } from './knowledge'
import { saves } from './saves'
import { findClock } from './time'
import { createNewWorldSave, standAt, takeOut } from './party'

const two = (n: number): string => String(n).padStart(2, '0')

function whenIn(save: GameSave): string | null {
  const def = findClock(save)
  if (!def) return null
  const clock = new GameClock(def.clock)
  clock.time = save.clock.time
  const c = clock.calendar()
  return `Day ${c.day}, ${two(c.hour)}:${two(c.minute)}`
}

type Places = Record<string, Record<string, unknown>>

function placeName(places: Places, key: string): string {
  return String(places[key]?.Name || key)
}

function mapForPlace(world: string, places: Places, key: string): string | null {
  const uses = worlds.mapUses(world)
  const path = placePath(places, key)
  return (uses.find((u) => path.some((k) => k in u.shapes)) ?? uses[0])?.map ?? null
}

function resolveSpatialLocation(
  world: string,
  actorId: string,
  save: GameSave | null,
  places: Places,
  regions: Places,
  fallbackWhere: string
): { map: string | null; place: string | null; placeName: string | null } {
  const uses = worlds.mapUses(world)
  for (const use of uses) {
    const merged: Record<string, Standing> = { ...use.stand, ...(save?.stand[use.map] ?? {}) }
    const st = merged[actorId]
    if (!st) continue
    const placeKey = smallestAt(use.shapes, st.at)
    if (placeKey) {
      return { map: use.map, place: placeKey, placeName: placeName(places, placeKey) }
    }
    const regionKey = smallestAt(use.regionShapes ?? {}, st.at)
    if (regionKey) {
      return { map: use.map, place: null, placeName: placeName(regions, regionKey) }
    }
    return { map: use.map, place: null, placeName: 'Wilderness' }
  }
  const place = placesIn(fallbackWhere, world, places)[0] ?? null
  const map = place ? mapForPlace(world, places, place) : null
  return {
    map,
    place,
    placeName: place ? placeName(places, place) : fallbackWhere === 'Wilderness' ? 'Wilderness' : null
  }
}

export function whereabouts(sheet: string): Whereabouts | null {
  const npc = splitNpcRef(sheet)
  if (npc) {
    if (!worlds.exists(npc.world)) return null
    const found = npcs.find(npc.id, npc.world, 'play')
    if (!found) return null
    const actorId = npcActorId(npc.world, found.id)
    const save = saveInPlay(npc.world, false) ?? saves.current(npc.world)
    const places = worlds.entities(npc.world, PLACE_TYPE_KEY, false)
    const regions = worlds.entities(npc.world, REGION_TYPE_KEY, false)
    const loc = resolveSpatialLocation(npc.world, actorId, save, places, regions, found.story.where)
    if (!loc.place && !loc.map) return null
    return {
      world: npc.world,
      worldName: worlds.meta(npc.world).name,
      save: save?.id ?? '',
      saveName: save?.name ?? 'World Template',
      map: loc.map,
      mapName: loc.map ? (maps.get(loc.map)?.name ?? loc.map) : null,
      place: loc.place,
      placeName: loc.placeName,
      when: save ? whenIn(save) : null
    }
  }
  const s = getSheet(sheet)
  const save = s.save ? saves.read(s.save) : null
  if (!save || !worlds.exists(save.world)) return null
  const places = worlds.entities(save.world, PLACE_TYPE_KEY, false)
  const regions = worlds.entities(save.world, REGION_TYPE_KEY, false)
  const held = save.characters[s.id]
  const loc = resolveSpatialLocation(save.world, s.id, save, places, regions, held?.where ?? '')
  return {
    world: save.world,
    worldName: worlds.meta(save.world).name,
    save: save.id,
    saveName: save.name,
    map: loc.map,
    mapName: loc.map ? (maps.get(loc.map)?.name ?? loc.map) : null,
    place: loc.place,
    placeName: loc.placeName,
    when: whenIn(save)
  }
}

export function destinations(): Destination[] {
  return worlds.list().flatMap((w) => {
    const uses = worlds.mapUses(w.id)
    if (!uses.length) return []
    const places = worlds.entities(w.id, PLACE_TYPE_KEY, false)
    const regions = worlds.entities(w.id, REGION_TYPE_KEY, false)
    const on = (map: string) => ({ world: w.id, worldName: w.name, map, mapName: maps.get(map)?.name ?? map })
    return [
      ...uses.map((u) => ({ ...on(u.map), place: '', placeName: '' })),
      ...Object.keys(places).map((key) => ({ ...on(mapForPlace(w.id, places, key) ?? uses[0].map), place: key, placeName: placeBreadcrumbNames(places, regions, key).join(' › ') }))
    ]
  })
}

export function moveCharacter(sheet: string, world: string, map: string, place: string): Whereabouts | null {
  if (!worlds.exists(world)) throw new WorldError(`There is no world "${world}"`)
  if (!splitNpcRef(sheet)) {
    const s = getSheet(sheet)
    if (!s.game) {
      const defGame = defaultCharacterGameRecord(s.title, s.id)
      if (defGame) setGame(s.id, defGame)
    }
  }
  const save = saves.current(world) ?? createNewWorldSave(world, 'Save 1')
  standAt(sheet, save.id, map, place)
  return whereabouts(sheet)
}

export function placeCharacter(world: string, sheet: string, map: string | null): void {
  const target = map ?? worlds.mapUses(world)[0]?.map
  if (!target) throw new WorldError(`${worlds.meta(world).name} has no map yet. Add a map to it, then add the character.`)
  moveCharacter(sheet, world, target, '')
}

export function removeCharacter(sheet: string): void {
  const npc = splitNpcRef(sheet)
  if (npc) {
    const actorId = npcActorId(npc.world, npc.id)
    takeOut(actorId)
    for (const w of worlds.list()) if (w.player === actorId) worlds.setPlayer(w.id, null)
    return
  }
  const s = getSheet(sheet)
  takeOut(s.id)
  for (const w of worlds.list()) if (w.player === s.id) worlds.setPlayer(w.id, null)
}

export function worldOfSheet(sheet: string): string | null {
  const npc = splitNpcRef(sheet)
  if (npc) return worlds.exists(npc.world) ? npc.world : null
  const id = findSheet(sheet)
  if (!id) return null
  const s = getSheet(id)
  const save = s.save ? saves.read(s.save) : null
  return save && worlds.exists(save.world) ? save.world : (worldsOfSheet(s.id)[0] ?? null)
}

export function characterBinding(sheets: string[]): WorldBinding | null {
  for (const ref of sheets) {
    const sheet = findSheet(ref)
    const world = sheet ? worldOfSheet(sheet) : null
    if (!sheet || !world) continue
    const type = Object.keys(worlds.schema(world).types)[0]
    return type ? { worldId: world, type, id: worldId(getSheet(sheet).title).replace(/\s+/g, '_') } : null
  }
  return null
}
