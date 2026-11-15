import { CONDITIONS, type EffectGroup } from '../../effectGroups'
import { registerComponent } from '../../core'
import { ActionPiece, type ActionEvent } from '../Action'
import { BUFF_MATCH_PARAMS, buffLinks, matchedBuffs } from './buffMatch'

export class RemoveBuff extends ActionPiece {
  static readonly type: string = 'action.removeBuff'
  static readonly DESCRIPTION: string = 'Takes buffs off the target: one buff, or buffs with a tag, oldest first.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    ...BUFF_MATCH_PARAMS,
    count: { kind: 'number' as const, default: 0, min: 0, description: 'How many buffs to take off. 0 takes off all that match.' }
  }
  static readonly SENTENCE: string = 'Remove[ {count} of][ {buff}][ buffs tagged {tag}] from the {who}'
  static readonly GROUP: EffectGroup | null = CONDITIONS
  static readonly ICON: string = 'Eraser'

  handle(event: ActionEvent): void {
    const { buffs, found, words } = matchedBuffs(event.target, this.params)
    const name = event.target?.named ?? 'No one'
    const count = Number(this.params.count)
    const gone = count > 0 ? found.slice(0, count) : found
    if (!buffs || !gone.length) return this.report(event, { removed: 0 }, `${name} has no ${words} to remove.`)
    for (const b of gone) buffs.removeBuff(b)
    this.report(event, { removed: gone.length }, `${buffLinks(gone)} removed from ${name}.`)
    this.next(event)
  }
}

registerComponent(RemoveBuff)
