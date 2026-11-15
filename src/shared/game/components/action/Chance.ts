import { LUCK, type EffectGroup } from '../../effectGroups'
import { registerComponent, roll, type TooltipRow } from '../../core'
import { ActionPiece, type ActionEvent, type EffectBranch } from '../Action'

export class Chance extends ActionPiece {
  static readonly type: string = 'action.chance'
  static readonly DESCRIPTION: string = 'Rolls a chance; on success sends its event on to the next pieces, otherwise sends `onFail`.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    percent: { kind: 'formula' as const, default: '50', min: 0, max: 100, description: 'Chance of success out of 100, e.g. 50 + user.dex.' },
    onFail: { kind: 'text' as const, default: '', description: 'Event sent on failure. Empty sends nothing.' }
  }
  static readonly SENTENCE: string = '{percent}% chance'
  static readonly GROUP: EffectGroup | null = LUCK
  static readonly ICON: string = 'Dices'
  static readonly AIMS: boolean = false
  static readonly BRANCHES: EffectBranch[] = [
    { param: 'emit', label: 'Passed', tone: 'pass', always: true },
    { param: 'onFail', label: 'Failed', tone: 'fail', always: true }
  ]

  tooltipRows(): TooltipRow[] {
    return [{ label: 'Chance', value: `${String(this.params.percent)} in 100` }]
  }

  handle(event: ActionEvent): void {
    const percent = this.value(String(this.params.percent), event)
    const hit = roll(event.user.uid, this.seed(event)) * 100 < percent
    this.report(event, { percent: Math.round(percent), passed: hit }, `Chance (${Math.round(percent)}%): ${hit ? 'passed' : 'failed'}.`)
    if (hit) return this.next(event)
    this.branch(event, String(this.params.onFail))
  }
}

registerComponent(Chance)
