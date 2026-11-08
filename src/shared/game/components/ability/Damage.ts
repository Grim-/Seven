import { registerComponent } from '../../core'
import { AbilityPiece, type AbilityEvent } from '../Abilities'
import { Health } from '../Health'

export class Damage extends AbilityPiece {
  static readonly type: string = 'ability.damage'
  static readonly DESCRIPTION: string = 'Damages the target once.'
  static readonly PARAMS = {
    ...AbilityPiece.PARAMS_BASE,
    amount: { kind: 'formula' as const, default: '1d6', description: 'Damage before resists, e.g. 2d6 + user.str.' },
    damageType: { kind: 'template' as const, templateKind: 'damageType', default: '', description: 'What the damage counts as.' }
  }

  handle(event: AbilityEvent): void {
    const health = event.target?.comp(Health)
    if (!health || health.isDead) return
    health.damage(this.value(String(this.params.amount), event), { type: String(this.params.damageType), cause: event.action.id, source: event.user })
    this.next(event)
  }
}

registerComponent(Damage)
