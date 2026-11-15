import { HARM, type EffectGroup } from '../../effectGroups'
import { registerComponent } from '../../core'
import { ActionPiece, type ActionEvent } from '../Action'
import { Health } from '../Health'

export class Kill extends ActionPiece {
  static readonly type: string = 'action.kill'
  static readonly DESCRIPTION: string = 'Kills the target outright.'
  static readonly PARAMS = { ...ActionPiece.PARAMS_BASE }
  static readonly SENTENCE: string = 'Slay the {who} outright'
  static readonly GROUP: EffectGroup | null = HARM
  static readonly ICON: string = 'Skull'

  handle(event: ActionEvent): void {
    const name = event.target?.named ?? 'No one'
    const health = event.target?.comp(Health)
    if (!health || health.isDead) return this.report(event, {}, `${name} cannot be killed.`)
    health.kill(event.action.id)
    this.report(event, {}, `${name} is slain outright.`)
    this.next(event)
  }
}

registerComponent(Kill)
