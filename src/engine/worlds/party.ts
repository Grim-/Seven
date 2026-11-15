import { noteFailure } from '../util/report'
import { mapArea, placesIn } from '@shared/maps'
import { PLACE_TYPE_KEY } from '@shared/world'
import type { GameSave } from '@shared/game/save'
import { shapeBounds } from '@shared/shapes'
import { maps } from '../maps/store'
import { getSheet, setSheetSave, sheetIds, storedGame } from '../library/sheets'
import { saves } from './saves'
import { WorldError, worlds } from './store'

function without(save: GameSave, sheet: string): GameSave {
  const { [sheet]: _gone, ...characters } = save.characters
  const stand = Object.fromEntries(Object.entries(save.stand).map(([map, list]) => [map, Object.fromEntries(Object.entries(list).filter(([s]) => s !== sheet))]))
  return { ...save, characters, stand }
}

export function takeOut(sheet: string): GameSave | null {
  const s = getSheet(sheet)
  const save = s.save ? saves.read(s.save) : null
  if (!save) {
    if (s.save) setSheetSave(s.id, '')
    return null
  }
  const held = save.characters[s.id]
  const next = saves.write(without(save, s.id))
  setSheetSave(s.id, '', { game: held?.game ?? null, gameRules: worlds.exists(save.world) ? worlds.meta(save.world).rules : '' })
  return next
}

export function bring(id: string, sheet: string, where = ''): GameSave {
  const save = saves.get(id)
  const s = getSheet(sheet)
  if (s.save === id) return save
  if (s.save) takeOut(s.id)
  const carried = storedGame(s.id)
  const next = saves.change(id, (v) => ({ ...v, characters: { ...v.characters, [s.id]: { game: carried.game, where } } }))
  setSheetSave(s.id, id)
  return next
}

export function removeSave(id: string): boolean {
  const save = saves.read(id)
  if (!save) return false
  for (const sheet of Object.keys(save.characters)) takeOut(sheet)
  return saves.remove(id)
}

export function removeWorldSaves(world: string): number {
  const list = saves.list(world)
  for (const s of list) removeSave(s.id)
  return list.length
}

export function createNewWorldSave(world: string, name: string): GameSave {
  const save = saves.create(world, name, false)
  if (!worlds.exists(world)) return save

  const w = worlds.meta(world)
  const stood = worlds.oldStand(world)
  const standingSheets = new Set<string>()
  for (const standMap of Object.values(stood)) {
    for (const sheetId of Object.keys(standMap)) {
      standingSheets.add(sheetId)
    }
  }
  if (w.player) standingSheets.add(w.player)

  // Ensure designated player character is physically placed on the first map if not already positioned
  if (w.player) {
    const isPlaced = Object.values(stood).some((m) => Boolean(m[w.player!]))
    if (!isPlaced) {
      const firstMap = Object.keys(stood)[0] ?? worlds.mapUses(world)[0]?.map
      if (firstMap) {
        const m = maps.get(firstMap)
        const area = m ? mapArea(m) : { w: 800, h: 600 }
        const at = { x: Math.round(area.w / 2), y: Math.round(area.h / 2) }
        stood[firstMap] = {
          ...(stood[firstMap] ?? {}),
          [w.player]: { at, actions: '', decisions: '' }
        }
      }
    }
  }

  for (const sheetId of standingSheets) {
    try {
      bring(save.id, sheetId, '')
    } catch (err) {
      noteFailure(err, 'worlds', 'Could not bring a character into the save')
      // Ignore if sheet doesn't exist
    }
  }

  return saves.change(save.id, (v) => ({
    ...v,
    stand: { ...stood }
  }))
}

export function adoptOldPlay(world: string): GameSave {
  if (!worlds.exists(world)) throw new WorldError(`There is no world "${world}"`)
  const save = saves.current(world) ?? createNewWorldSave(world, 'Save 1')
  const places = worlds.schema(world).types[PLACE_TYPE_KEY] ? worlds.entities(world, PLACE_TYPE_KEY, false, 'template') : {}
  const stood = worlds.oldStand(world)
  const standing = new Set(Object.values(stood).flatMap((list) => Object.keys(list)))
  const placed = new Map<string, string>()
  for (const { id } of sheetIds()) {
    const s = getSheet(id)
    if (s.save) continue
    if (placesIn(s.story.where, world, places).length || standing.has(id)) placed.set(id, s.story.where)
  }
  for (const [sheet, where] of placed) bring(save.id, sheet, where)
  const journeys = worlds.oldJourneys(world)
  return saves.change(save.id, (v) => ({
    ...v,
    stand: { ...v.stand, ...Object.fromEntries(Object.entries(stood).map(([map, list]) => [map, { ...Object.fromEntries(Object.entries(list).filter(([sheet]) => sheet in v.characters)), ...(v.stand[map] ?? {}) }])) },
    journeys: { ...journeys, ...v.journeys },
    board: v.board.length ? v.board : worlds.oldBoard(world)
  }))
}

export function travel(sheet: string, id: string, map: string, place: string): GameSave {
  const save = saves.get(id)
  const uses = worlds.mapUses(save.world)
  const use = uses.find((u) => u.map === map) ?? uses[0]
  if (!use) throw new WorldError(`${worlds.meta(save.world).name} has no map to arrive on.`)
  const form = place ? use.shapes[place] : undefined
  const size = maps.get(use.map)?.size ?? { w: 0, h: 0 }
  const box = form ? shapeBounds(form) : null
  const at = box ? { x: Math.round(box.x + box.w / 2), y: Math.round(box.y + box.h / 2) } : { x: Math.round(size.w / 2), y: Math.round(size.h / 2) }
  const s = getSheet(sheet)
  bring(id, s.id, form ? `@place:${place}` : '')
  saves.change(id, (v) => ({ ...v, stand: { ...v.stand, [use.map]: { ...(v.stand[use.map] ?? {}), [s.id]: { at, actions: '', decisions: '' } } } }))
  saves.select(save.world, id)
  return saves.get(id)
}
