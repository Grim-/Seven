import type { GameSave } from '@shared/game/save'
import { setSheetLayer } from '../library/sheets'
import { currentActor } from '../timeline/actor'
import { saves } from './saves'
import { worlds } from './store'
import { restand } from './tokenSources'

export function saveInPlay(world: string, create: boolean): GameSave | null {
  const { sessionId } = currentActor()
  if (sessionId) {
    const pinned = saves.pinned(sessionId, world)
    const hit = pinned ? saves.read(pinned) : null
    if (hit && hit.world === world) return hit
  }
  const save = create ? saves.current(world) : saves.currentOrNull(world)
  if (save && sessionId) saves.pin(sessionId, world, save.id)
  return save
}

const reading = (world: string): GameSave | null => saveInPlay(world, false)

const writing = (world: string, fn: (save: GameSave) => GameSave): void => {
  const save = saveInPlay(world, true)
  if (save) saves.write(fn(save))
}

worlds.setPlayLayer({
  records: (world, type) => reading(world)?.records[type] ?? {},
  setRecord: (world, type, key, value) => writing(world, (s) => ({ ...s, records: { ...s.records, [type]: { ...(s.records[type] ?? {}), [key]: value } } })),
  stand: (world, map) => reading(world)?.stand[map] ?? {},
  setStand: (world, map, stand) => writing(world, (s) => restand(s, map, stand)),
  journeys: (world) => reading(world)?.journeys ?? {},
  addJourney: (world, sheet, entry) => writing(world, (s) => ({ ...s, journeys: { ...s.journeys, [sheet]: [...(s.journeys[sheet] ?? []), entry] } })),
  board: (world) => reading(world)?.board ?? [],
  setBoard: (world, list) => writing(world, (s) => ({ ...s, board: list }))
})

setSheetLayer({
  read: (sheet, id) => {
    const save = saves.read(id)
    const held = save?.characters[sheet]
    if (!save || !held) return null
    return { game: held.game, where: held.where, gameRules: worlds.exists(save.world) ? worlds.meta(save.world).rules : '' }
  },
  writeGame: (sheet, id, game) => void saves.change(id, (s) => ({ ...s, characters: { ...s.characters, [sheet]: { ...(s.characters[sheet] ?? { where: '' }), game } } })),
  writeWhere: (sheet, id, where) => void saves.change(id, (s) => ({ ...s, characters: { ...s.characters, [sheet]: { ...(s.characters[sheet] ?? { game: null }), where } } }))
})
