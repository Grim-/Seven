import { registerComponent, roll, type TooltipRow } from '../../core'
import { ActionPiece, type ActionEvent } from '../Action'

export class Chance extends ActionPiece {
  static readonly type: string = 'action.chance'
  static readonly DESCRIPTION: string = 'Rolls a chance; on success sends its event on to the next pieces, otherwise sends `onFail`.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    percent: { kind: 'formula' as const, default: '50', description: 'Chance of success out of 100, e.g. 50 + user.dex.' },
    onFail: { kind: 'text' as const, default: '', description: 'Event sent on failure. Empty sends nothing.' }
  }

  tooltipRows(): TooltipRow[] {
    return [{ label: 'Chance', value: `${String(this.params.percent)} in 100` }]
  }

  handle(event: ActionEvent): void {
    const action = event.action
    const hit = roll(event.user.uid, this.seed(event)) * 100 < this.value(String(this.params.percent), event)
    if (hit) return this.next(event)
    const fail = String(this.params.onFail)
    if (fail) action.emit(fail, { ...event })
  }
}

registerComponent(Chance)
