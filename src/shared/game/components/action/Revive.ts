import { HELP, type EffectGroup } from '../../effectGroups'
import { registerComponent } from '../../core'
import { ActionPiece, type ActionEvent } from '../Action'
import { Health } from '../Health'

export class Revive extends ActionPiece {
  static readonly type: string = 'action.revive'
  static readonly DESCRIPTION: string = 'Brings the target back from death (or zero health) at a fraction of max health.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    fraction: { kind: 'number' as const, default: 0.5, min: 0.01, max: 1, description: 'Fraction of max health restored (0.01–1).' }
  }
  static readonly SENTENCE: string = 'Revive the {who} at {fraction} health'
  static readonly GROUP: EffectGroup | null = HELP
  static readonly ICON: string = 'HeartPulse'

  handle(event: ActionEvent): void {
    const name = event.target?.named ?? 'No one'
    const health = event.target?.comp(Health)
    if (!health || (!health.isDead && health.get() > 0)) {
      return this.report(event, { revived: false }, `${name} does not need revival.`)
    }
    const fraction = Math.max(0.01, Math.min(1, Number(this.params.fraction ?? 0.5)))
    health.revive(fraction)
    this.report(event, { revived: true, health: health.get() }, `${name} returns from the brink with ${health.get()} health.`)
    this.next(event)
  }
}

registerComponent(Revive)
