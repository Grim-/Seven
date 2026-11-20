import type { GameSave } from '@shared/game/save'
import type { CreatureSpawner, MapData } from '@shared/maps'
import type { Point } from '@shared/shapes'
import { GameEntity } from '@shared/game/core'
import { Health } from '@shared/game/components'
import { maps } from '../maps/store'
import { report } from '../util/report'
import { blueprintCatalog, blueprintCreature, blueprintSourceOf } from './blueprints'
import { saveInPlay } from './playLayer'
import { saves } from './saves'
import { resetDue, spawnDue } from './spawnRules'
import './spawnRules/index'

const SPAWNED = 'spawners'

interface Spawned {
  creature: string
  at: number
}

function spawnedBy(save: GameSave, spawner: string): Spawned | null {
  const held = save.records[SPAWNED]?.[spawner]
  return held && typeof held.creature === 'string' && typeof held.at === 'number' ? { creature: held.creature, at: held.at } : null
}

function partyOn(save: GameSave, map: string): Point[] {
  const stand = save.stand[map] ?? {}
  return Object.keys(save.characters).flatMap((sheet) => (stand[sheet] ? [stand[sheet].at] : []))
}

function standing(save: GameSave, source: string, uid: string): boolean {
  const creature = save.creatures.find((c) => c.uid === uid)
  if (!creature) return false
  return !GameEntity.fromRecord(creature, blueprintCatalog(source)).comp(Health)?.isDead
}

function clear(save: GameSave, uid: string): GameSave {
  return {
    ...save,
    creatures: save.creatures.filter((c) => c.uid !== uid),
    stand: Object.fromEntries(Object.entries(save.stand).map(([map, list]) => [map, Object.fromEntries(Object.entries(list).filter(([token]) => token !== uid))]))
  }
}

function place(save: GameSave, map: string, spawner: CreatureSpawner, source: string): GameSave {
  const record = blueprintCreature(source, spawner.monsterId, spawner.name)
  return {
    ...save,
    creatures: [...save.creatures, { ...record, faction: spawner.faction ?? '', disposition: spawner.disposition }],
    stand: { ...save.stand, [map]: { ...(save.stand[map] ?? {}), [record.uid]: { at: spawner.at, actions: spawner.actions ?? '', decisions: spawner.decisions ?? '' } } },
    records: { ...save.records, [SPAWNED]: { ...(save.records[SPAWNED] ?? {}), [spawner.id]: { creature: record.uid, at: save.clock.time } } }
  }
}

function wake(save: GameSave, map: string, spawner: CreatureSpawner, entering: boolean): GameSave {
  const source = blueprintSourceOf(spawner.monsterId)
  if (!source) {
    report('warning', 'worlds', `Spawner ${spawner.name} on map ${map}: no bestiary has "${spawner.monsterId}".`)
    return save
  }
  const held = spawnedBy(save, spawner.id)
  const check = { spawner, save, party: partyOn(save, map), entering, spawnedAt: held?.at ?? null }
  if (!held) return spawnDue(check) ? place(save, map, spawner, source) : save
  if (standing(save, source, held.creature) || !resetDue(check)) return save
  return place(clear(save, held.creature), map, spawner, source)
}

export function wakeSpawners(save: GameSave, map: MapData, entering: boolean): GameSave {
  return (map.spawners ?? []).reduce((next, spawner) => wake(next, map.id, spawner, entering), save)
}

export function wakeMapSpawners(world: string, mapId: string, entering: boolean): GameSave | null {
  const map = maps.get(mapId)
  const save = saveInPlay(world, true)
  if (!map || !save) return save
  const next = wakeSpawners(save, map, entering)
  return next === save ? save : saves.write(next)
}
