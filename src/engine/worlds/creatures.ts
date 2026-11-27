import type { EntityRecord } from '@shared/game/core/GameEntity'
import type { GameSave } from '@shared/game/save'
import type { Point } from '@shared/shapes'
import { npcs } from './npcs'

export function spawnCreature(world: string, map: string, creature: EntityRecord, faction: string, at: Point): GameSave {
  return npcs.spawnEntityInSave(world, map, creature, faction, at).save
}

export function updateCreature(world: string, creature: EntityRecord, faction?: string): GameSave {
  return npcs.updateEntityInSave(world, creature, faction)
}
