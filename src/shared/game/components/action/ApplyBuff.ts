import { registerComponent, type TooltipRow } from '../../core'
import { ActionPiece, type ActionEvent } from '../Action'
import { Buffs } from '../Buffs'

export class ApplyBuff extends ActionPiece {
  static readonly type: string = 'action.applyBuff'
  static readonly DESCRIPTION: string = 'Puts a buff on the target, from its template.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    buff: { kind: 'template' as const, templateKind: 'game_buff', default: '', description: 'Which buff.' }
  }

  tooltipRows(): TooltipRow[] {
    const id = String(this.params.buff)
    const def = id ? this.entity?.catalog.template(ApplyBuff.PARAMS.buff.templateKind, id) : null
    return id ? [{ label: 'Applies', value: String(def?.label || id) }] : []
  }

  handle(event: ActionEvent): void {
    const buffs = event.target?.comp(Buffs)
    const def = event.user.catalog.template(ApplyBuff.PARAMS.buff.templateKind, String(this.params.buff))
    if (!buffs || !def) return
    if (buffs.apply(def, event.user)) this.next(event)
  }
}

registerComponent(ApplyBuff)
