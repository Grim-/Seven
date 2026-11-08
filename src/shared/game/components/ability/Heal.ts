import { registerComponent } from '../../core'
import { AbilityPiece, type AbilityEvent } from '../Abilities'
import { Health } from '../Health'

export class Heal extends AbilityPiece {
  static readonly type: string = 'ability.heal'
  static readonly DESCRIPTION: string = 'Heals the target once.'
  static readonly PARAMS = {
    ...AbilityPiece.PARAMS_BASE,
    amount: { kind: 'formula' as const, default: '1d8', description: 'Health restored, e.g. 1d8 + user.wis.' }
  }

  handle(event: AbilityEvent): void {
    const health = event.target?.comp(Health)
    if (!health || health.isDead) return
    health.heal(this.value(String(this.params.amount), event), event.action.id)
    this.next(event)
  }
}

registerComponent(Heal)
