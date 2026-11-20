import type { GameSave } from '@shared/game/save'
import type { CreatureSpawner, SpawnerResetMode, SpawnerTriggerMode } from '@shared/maps'
import type { Point } from '@shared/shapes'

export interface SpawnCheck {
  spawner: CreatureSpawner
  save: GameSave
  party: Point[]
  entering: boolean
  spawnedAt: number | null
}

export interface SpawnRule<Id extends string> {
  id: Id
  due(check: SpawnCheck): boolean
}

const spawnRules: SpawnRule<SpawnerTriggerMode>[] = []
const resetRules: SpawnRule<SpawnerResetMode>[] = []

function put<Id extends string>(list: SpawnRule<Id>[], rule: SpawnRule<Id>): void {
  const at = list.findIndex((r) => r.id === rule.id)
  if (at >= 0) list[at] = rule
  else list.push(rule)
}

export function registerSpawnWhen(rule: SpawnRule<SpawnerTriggerMode>): void {
  put(spawnRules, rule)
}

export function registerResetWhen(rule: SpawnRule<SpawnerResetMode>): void {
  put(resetRules, rule)
}

export function spawnDue(check: SpawnCheck): boolean {
  return spawnRules.find((r) => r.id === check.spawner.spawnWhen)?.due(check) ?? false
}

export function resetDue(check: SpawnCheck): boolean {
  return resetRules.find((r) => r.id === check.spawner.resetWhen)?.due(check) ?? false
}
