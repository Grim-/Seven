import type { GameSave } from '@shared/game/save'
import { layerOn, mapThingKey, SPAWNER_THING, type CreatureSpawner, type MapData, type WorldMapUse } from '@shared/maps'
import type { Point } from '@shared/shapes'
import { npcActorId, splitNpcRef } from '@shared/worldNpcs'
import { maps } from '../maps/store'
import { report } from '../util/report'
import { effectCatalog } from '../effects/catalog'
import { npcs } from './npcs'
import { isSpawnedNpcStanding, resolveSpawnerTemplate, stampIntoSaveState, type ResolvedSpawnerTemplate } from './npcStamp'
import { saveInPlay } from './playLayer'
import { saves } from './saves'
import { worlds } from './store'
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
  const partyIds = save.party?.length ? save.party : Object.keys(save.characters)
  return partyIds.flatMap((id) => (stand[id] ? [stand[id].at] : []))
}

function clear(save: GameSave, actorOrUid: string): GameSave {
  const npcId = splitNpcRef(actorOrUid)?.id ?? actorOrUid
  const actorId = npcActorId(save.world, npcId)
  const { [npcId]: _gone, ...restNpcs } = save.npcs
  return {
    ...save,
    npcs: restNpcs,
    stand: Object.fromEntries(
      Object.entries(save.stand).map(([map, list]) => [
        map,
        Object.fromEntries(Object.entries(list).filter(([token]) => token !== actorId && token !== actorOrUid))
      ])
    )
  }
}

function place(save: GameSave, map: string, spawner: CreatureSpawner, target: ResolvedSpawnerTemplate, use: WorldMapUse | null): GameSave {
  const stamped = stampIntoSaveState(save, use ? [use] : [], {
    target,
    customName: spawner.name,
    faction: spawner.faction ?? undefined,
    disposition: spawner.disposition,
    lootTableId: spawner.lootTableId ?? null,
    map,
    at: spawner.at,
    actions: spawner.actions ?? '',
    decisions: spawner.decisions ?? ''
  })
  return {
    ...stamped.save,
    records: {
      ...stamped.save.records,
      [SPAWNED]: { ...(stamped.save.records[SPAWNED] ?? {}), [spawner.id]: { creature: stamped.actorId, at: save.clock.time } }
    }
  }
}

function wake(save: GameSave, map: string, spawner: CreatureSpawner, entering: boolean, use: WorldMapUse | null): GameSave {
  const target = resolveSpawnerTemplate(spawner.monsterId, save.world)
  if (!target) {
    report('warning', 'worlds', `Spawner ${spawner.name} on map ${map}: no archetype or bestiary has "${spawner.monsterId}".`)
    return save
  }
  const held = spawnedBy(save, spawner.id)
  const check = { spawner, save, party: partyOn(save, map), entering, spawnedAt: held?.at ?? null }
  if (!held) return spawnDue(check) ? place(save, map, spawner, target, use) : save
  if (isSpawnedNpcStanding(save, spawner.monsterId, held.creature, effectCatalog()) || !resetDue(check)) return save
  return place(clear(save, held.creature), map, spawner, target, use)
}

function rest(save: GameSave, spawner: CreatureSpawner): GameSave {
  const held = spawnedBy(save, spawner.id)
  if (!held || save.battle) return save
  const { [spawner.id]: _gone, ...kept } = save.records[SPAWNED] ?? {}
  return { ...clear(save, held.creature), records: { ...save.records, [SPAWNED]: kept } }
}

export function wakeSpawners(save: GameSave, map: MapData, entering: boolean, use: WorldMapUse | null = null): GameSave {
  const on = (s: CreatureSpawner) => !use || layerOn(use, mapThingKey(SPAWNER_THING, s.id), save.flags)
  return (map.spawners ?? []).reduce((next, spawner) => (on(spawner) ? wake(next, map.id, spawner, entering, use) : rest(next, spawner)), save)
}

export function wakeMapSpawners(world: string, mapId: string, entering: boolean): GameSave | null {
  const map = maps.get(mapId)
  const save = saveInPlay(world, true)
  if (!map || !save) return save
  const next = wakeSpawners(save, map, entering, worlds.mapUses(world).find((u) => u.map === mapId) ?? null)
  if (next === save) return save
  const written = saves.write(next)
  npcs.emit('changed', world)
  return written
}
