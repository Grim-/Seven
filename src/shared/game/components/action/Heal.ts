import { registerComponent, type TooltipRow } from '../../core'
import { ActionPiece, type ActionEvent } from '../Action'
import { Health } from '../Health'

export class Heal extends ActionPiece {
  static readonly type: string = 'action.heal'
  static readonly DESCRIPTION: string = 'Heals the target once.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    amount: { kind: 'formula' as const, default: '1d8', description: 'Health restored, e.g. 1d8 + user.wis.' }
  }

  tooltipRows(): TooltipRow[] {
    return [{ label: 'Heals', value: String(this.params.amount) }]
  }

  handle(event: ActionEvent): void {
    const health = event.target?.comp(Health)
    if (!health || health.isDead) return
    health.heal(this.value(String(this.params.amount), event), event.action.id)
    this.next(event)
  }
}

registerComponent(Heal)
