import { HELP, type EffectGroup } from '../../effectGroups'
import { registerComponent } from '../../core'
import { ActionPiece, type ActionEvent } from '../Action'
import { Progression } from '../Progression'

export class AwardXp extends ActionPiece {
  static readonly type: string = 'action.awardXp'
  static readonly DESCRIPTION: string = 'Grants XP to the target character (which also cascades to each of its classes).'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    amount: { kind: 'formula' as const, default: '50', description: 'XP amount or formula to grant.' },
    reason: { kind: 'text' as const, default: '', description: 'Optional reason logged to Progression / Story Sheet.' }
  }
  static readonly SENTENCE: string = 'Award {amount} XP to the {who}'
  static readonly GROUP: EffectGroup | null = HELP
  static readonly ICON: string = 'Sparkles'

  handle(event: ActionEvent): void {
    const name = event.target?.named ?? 'No one'
    const prog = event.target?.comp(Progression)
    if (!prog) return this.report(event, { gained: 0 }, `${name} has no Progression component.`)
    const amount = Math.round(this.value(String(this.params.amount ?? '0'), event))
    const res = prog.grantXp(amount, String(this.params.reason || event.action.id))
    this.report(event, res, `${name} gained ${res.gained} XP (level ${res.level}).`)
    this.next(event)
  }
}

registerComponent(AwardXp)
