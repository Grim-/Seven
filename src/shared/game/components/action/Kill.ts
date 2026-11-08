import { registerComponent } from '../../core'
import { ActionPiece, type ActionEvent } from '../Action'
import { Health } from '../Health'

export class Kill extends ActionPiece {
  static readonly type: string = 'action.kill'
  static readonly DESCRIPTION: string = 'Kills the target outright.'
  static readonly PARAMS = { ...ActionPiece.PARAMS_BASE }

  handle(event: ActionEvent): void {
    const health = event.target?.comp(Health)
    if (!health || health.isDead) return
    health.kill(event.action.id)
    this.next(event)
  }
}

registerComponent(Kill)
