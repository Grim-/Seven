import type { EntityRecord } from '@shared/game/core/GameEntity'
import type { GameSave, SaveCreature } from '@shared/game/save'
import type { Point } from '@shared/shapes'
import { saves } from './saves'
import { saveInPlay } from './playLayer'
import { WorldError } from './store'

function playing(world: string): GameSave {
  const save = saveInPlay(world, true)
  if (!save) throw new WorldError('This world has no save to play in.')
  return save
}

export function spawnCreature(world: string, map: string, creature: EntityRecord, faction: string, at: Point): GameSave {
  const save = playing(world)
  if (save.creatures.some((c) => c.uid === creature.uid)) throw new WorldError(`${creature.name} is already in this save.`)
  const made: SaveCreature = { ...creature, faction }
  return saves.write({
    ...save,
    creatures: [...save.creatures, made],
    stand: { ...save.stand, [map]: { ...(save.stand[map] ?? {}), [creature.uid]: { at, actions: '', decisions: '' } } }
  })
}

export function updateCreature(world: string, creature: EntityRecord, faction?: string): GameSave {
  const save = playing(world)
  const old = save.creatures.find((c) => c.uid === creature.uid)
  if (!old) throw new WorldError(`${creature.name} is not in this save.`)
  return saves.write({ ...save, creatures: save.creatures.map((c) => (c.uid === creature.uid ? { ...creature, faction: faction ?? old.faction } : c)) })
}
