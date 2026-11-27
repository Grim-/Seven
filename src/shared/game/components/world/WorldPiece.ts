import { WORLD, type EffectGroup } from '../../effectGroups'
import type { Component, GameEntity } from '../../core'
import { ActionPiece, type ActionEvent } from '../Action'
import { Effects } from '../Effects'
import { WorldEffects } from '../WorldEffects'
import { Reaction } from '../Reaction'

export abstract class WorldPiece extends ActionPiece {
  static readonly GROUP: EffectGroup | null = WORLD

  canApply(host: Component | GameEntity): true | string {
    return host instanceof Effects || host instanceof WorldEffects || host instanceof Reaction
      ? true
      : 'only where the world can change: cards, triggers, trigger actions, world events, and reactions on map things'
  }

  send(event: ActionEvent, kind: string, data: Record<string, unknown>): void {
    event.view?.({ kind, data, entity: event.target?.uid ?? null })
  }
}
