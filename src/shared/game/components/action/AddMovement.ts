import { HELP, type EffectGroup } from '../../effectGroups'
import { registerComponent, type TooltipRow } from '../../core'
import { ActionPiece, type ActionEvent, type UseContext } from '../Action'

/** Grants additional tactical movement feet during the active turn (e.g. Dash). */
export class AddMovement extends ActionPiece {
  static readonly type: string = 'action.addMovement'
  static readonly DESCRIPTION: string = 'Adds movement feet during the current combat turn (e.g. Dash).'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    amount: { kind: 'formula' as const, default: 'user.speed', description: 'Movement feet gained this turn, e.g. user.speed.' }
  }
  static readonly SENTENCE: string = 'Grant {who} +{amount} ft movement this turn'
  static readonly GROUP: EffectGroup | null = HELP
  static readonly ICON: string = 'Footprints'

  tooltipRows(): TooltipRow[] {
    return [{ label: 'Movement', value: `+${String(this.params.amount)} ft` }]
  }

  handle(event: ActionEvent): void {
    const target = event.target ?? event.user
    const feet = Math.max(0, Math.round(this.value(String(this.params.amount || '0'), event)))
    event.grantMovement?.(feet)
    this.report(event, { feet }, `${target.named} gains +${feet} ft movement this turn.`)
    this.next(event)
  }

  score(_ctx: UseContext): number {
    return 0
  }
}

registerComponent(AddMovement)
