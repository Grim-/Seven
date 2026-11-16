import { CONDITIONS, type EffectGroup } from '../../effectGroups'
import { registerComponent } from '../../core'
import { ActionPiece, type ActionEvent } from '../Action'
import { Buff, Buffs } from '../Buffs'
import { Trait } from '../Traits'

export class RemoveSelf extends ActionPiece {
  static readonly type: string = 'action.removeSelf'
  static readonly DESCRIPTION: string = 'Removes the owning buff or trait after its downstream pieces run.'
  static readonly PARAMS = { emit: ActionPiece.PARAMS_BASE.emit }
  static readonly SENTENCE: string = 'Consume and remove this passive effect'
  static readonly GROUP: EffectGroup | null = CONDITIONS
  static readonly ICON: string = 'Flame'
  static readonly AIMS: boolean = false

  handle(event: ActionEvent): void {
    const hostAction = event.action
    const buffParent = this.parent instanceof Buff ? this.parent : hostAction.parent instanceof Buff ? hostAction.parent : null
    const ownerTrait = hostAction instanceof Trait ? hostAction : null
    this.report(event, { consumed: true }, `Consumed ${ownerTrait?.title ?? buffParent?.id ?? hostAction.id}.`)
    // Run downstream pieces before detaching the host component from the entity.
    this.next(event)
    if (ownerTrait) {
      ownerTrait.removeSelfFromOwner('consumed')
      return
    }
    if (buffParent && buffParent.parent instanceof Buffs) {
      buffParent.parent.removeBuff(buffParent)
    }
  }
}

registerComponent(RemoveSelf)
