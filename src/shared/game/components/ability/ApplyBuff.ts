import { registerComponent } from '../../core'
import { AbilityPiece, type AbilityEvent } from '../Abilities'
import { Buffs } from '../Buffs'

export class ApplyBuff extends AbilityPiece {
  static readonly type: string = 'ability.applyBuff'
  static readonly DESCRIPTION: string = 'Puts a buff on the target, from its template.'
  static readonly PARAMS = {
    ...AbilityPiece.PARAMS_BASE,
    buff: { kind: 'template' as const, templateKind: 'buff', default: '', description: 'Which buff.' }
  }

  handle(event: AbilityEvent): void {
    const buffs = event.target?.comp(Buffs)
    const def = event.user.catalog.template('buff', String(this.params.buff))
    if (!buffs || !def) return
    if (buffs.apply(def, event.user)) this.next(event)
  }
}

registerComponent(ApplyBuff)
