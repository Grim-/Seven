import { catalogFrom } from '@shared/game/defs'
import { dawnsBetween, type TimeDef } from '@shared/game/core'
import { longRest as dndLongRest, spendHitDice } from '@shared/dnd'
import type { GameSave } from '@shared/game/save'
import { advanceCharacters, signalCharacters } from '../../modules/game/characters'
import { gameDefs } from '../../modules/game/store'
import { almanacs } from '../almanac/store'
import { getSheet, setDnd } from '../library/sheets'
import { noteFailure } from '../util/report'
import { saves } from './saves'
import { wakeMapSpawners } from './spawners'
import { assertOutOfCombat } from './battleGate'
import { WorldError, worlds } from './store'

export function syncAlmanacs(save: GameSave): void {
  for (const alm of almanacs.list().filter((a) => a.saveId === save.id || (!a.saveId && a.worldId === save.world))) {
    if (save.clock.time <= alm.currentTime) continue
    try {
      almanacs.advanceClock(alm.id, 0, save.clock.time)
    } catch (err) {
      noteFailure(err, 'almanac', 'Could not sync save clock to Almanac')
    }
  }
}

export function findClock(save: GameSave): TimeDef | null {
  const cat = catalogFrom(gameDefs.catalog())
  return cat.time(save.clockId) ?? cat.times()[0] ?? null
}

export function clockOf(save: GameSave): TimeDef {
  const def = findClock(save)
  if (!def) throw new WorldError('There is no clock to move on.')
  return def
}

export function advanceWorldTime(
  id: string,
  seconds: number,
  source: string,
  sheets: string[],
  opts?: { skipTurnSignals?: boolean }
): GameSave {
  if (!(seconds > 0)) throw new WorldError('Time can only move forward.')
  const save = saves.get(id)
  const def = clockOf(save)
  const from = save.clock.time
  advanceCharacters(sheets, {
    from,
    seconds,
    roundSeconds: def.roundSeconds,
    dawns: dawnsBetween(def.clock, def.dawnHour, from, from + seconds),
    source,
    skipTurnSignals: opts?.skipTurnSignals
  })
  const saved = saves.writeClock(id, save.clockId || def.id, { time: from + seconds })
  syncAlmanacs(saved)
  return saved
}

const rollDie = (sides: number): number => 1 + Math.floor(Math.random() * sides)

export function shortRest(id: string, sheets: string[], hitDice: Record<string, number>): GameSave {
  assertOutOfCombat(saves.get(id), 'take a short rest')
  advanceWorldTime(id, clockOf(saves.get(id)).shortRestSeconds, 'short_rest', sheets)
  signalCharacters(sheets, 'OnShortRest')
  for (const [sheet, count] of Object.entries(hitDice)) {
    const s = getSheet(sheet)
    if (s.dnd && count > 0) setDnd(s.id, { ...s.dnd, ...spendHitDice(s.dnd, count, rollDie) })
  }
  return saves.get(id)
}

export function longRestIn(save: GameSave): number {
  return save.longRestAt === undefined ? 0 : Math.max(0, save.longRestAt + clockOf(save).longRestGapSeconds - save.clock.time)
}

export function longRest(id: string, sheets: string[]): GameSave {
  const save = saves.get(id)
  assertOutOfCombat(save, 'take a long rest')
  const wait = longRestIn(save)
  if (wait > 0) throw new WorldError(`A long rest is possible again in ${Math.ceil(wait / 3600)} h.`)
  advanceWorldTime(id, clockOf(save).longRestSeconds, 'long_rest', sheets)
  signalCharacters(sheets, 'OnLongRest')
  for (const sheet of sheets) {
    const s = getSheet(sheet)
    if (s.dnd) setDnd(s.id, { ...s.dnd, ...dndLongRest(s.dnd) })
  }
  const rested = saves.change(id, (v) => ({ ...v, longRestAt: v.clock.time }))
  for (const use of worlds.mapUses(rested.world)) {
    try {
      wakeMapSpawners(rested.world, use.map, false)
    } catch (err) {
      noteFailure(err, 'worlds', `Could not wake spawners after rest on ${use.map}`)
    }
  }
  return saves.get(id)
}
