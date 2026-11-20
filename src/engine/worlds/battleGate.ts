import type { BattleRecord } from '@shared/game/state/battle'
import type { GameSave } from '@shared/game/save'
import { ToolError } from '../tools/types'

export type CombatCost = 'action' | 'bonus' | 'free'

/** Returns the active battle on a save, or null when out of combat. */
export function activeBattleOf(save: GameSave | null | undefined): BattleRecord | null {
  return save?.battle?.status === 'active' ? save.battle : null
}

/** Ensures non-combat actions (rest, travel, manual save overwrites) do not run during active combat. */
export function assertOutOfCombat(save: GameSave | null | undefined, actionLabel: string): void {
  const battle = activeBattleOf(save)
  if (battle) {
    throw new ToolError(`Cannot ${actionLabel} while combat is active (Round ${battle.round}).`)
  }
}

/** Verifies the requested participant currently owns the active turn. */
export function assertTurnActor(battle: BattleRecord, actorId: string, requirePartySide = true): void {
  const active = battle.queue[battle.activeIndex]
  if (!active) throw new ToolError('There is no active combatant in the turn queue.')
  if (requirePartySide && active.side !== 'party') {
    throw new ToolError(`Wait your turn — enemy is acting.`)
  }
  if (active.id !== actorId) {
    throw new ToolError(`It is not ${actorId}'s turn.`)
  }
}

/** Verifies the active combatant has budget for the requested action cost without spending it yet. */
export function assertActionCost(battle: BattleRecord, cost: CombatCost): void {
  if (cost === 'action' && battle.economy.actionUsed) {
    throw new ToolError('Action has already been used this turn.')
  }
  if (cost === 'bonus' && battle.economy.bonusActionUsed) {
    throw new ToolError('Bonus action has already been used this turn.')
  }
}

/** Marks an action or bonus action spent on the active turn economy. */
export function consumeTurnCost(battle: BattleRecord, cost: CombatCost): BattleRecord {
  if (cost === 'free') return battle
  return {
    ...battle,
    economy: {
      ...battle.economy,
      actionUsed: battle.economy.actionUsed || cost === 'action',
      bonusActionUsed: battle.economy.bonusActionUsed || cost === 'bonus'
    }
  }
}

/** Verifies an entity still has its per-round reaction available. */
export function assertReactionAvailable(battle: BattleRecord, entityId: string): boolean {
  return battle.economy.reactionUsedBy[entityId] !== true
}

/** Marks an entity's reaction used for the current round. */
export function consumeReaction(battle: BattleRecord, entityId: string): BattleRecord {
  return {
    ...battle,
    economy: {
      ...battle.economy,
      reactionUsedBy: { ...battle.economy.reactionUsedBy, [entityId]: true }
    }
  }
}
