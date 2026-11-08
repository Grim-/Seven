import { registerComponent, type TooltipRow } from '../../core'
import { ActionPiece, type ActionEvent } from '../Action'
import { Health } from '../Health'

export class Damage extends ActionPiece {
  static readonly type: string = 'action.damage'
  static readonly DESCRIPTION: string = 'Damages the target once.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    amount: { kind: 'formula' as const, default: '1d6', description: 'Damage before resists, e.g. 2d6 + user.str.' },
    damageType: { kind: 'template' as const, templateKind: 'damage_type', default: '', description: 'What the damage counts as.' }
  }

  tooltipRows(): TooltipRow[] {
    const type = String(this.params.damageType)
    const label = type ? (this.entity?.catalog.damageType(type)?.label ?? type) : ''
    return [{ label: 'Damage', value: `${String(this.params.amount)}${label ? ` ${label}` : ''}` }]
  }

  handle(event: ActionEvent): void {
    const health = event.target?.comp(Health)
    if (!health || health.isDead) return
    health.damage(this.value(String(this.params.amount), event), { type: String(this.params.damageType), cause: event.action.id, source: event.user })
    this.next(event)
  }
}

registerComponent(Damage)
