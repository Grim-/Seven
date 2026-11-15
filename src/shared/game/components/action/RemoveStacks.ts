import { CONDITIONS, type EffectGroup } from '../../effectGroups'
import { registerComponent } from '../../core'
import { ActionPiece, type ActionEvent } from '../Action'
import { BUFF_MATCH_PARAMS, buffLinks, matchedBuffs } from './buffMatch'

export class RemoveStacks extends ActionPiece {
  static readonly type: string = 'action.removeStacks'
  static readonly DESCRIPTION: string = 'Takes stacks off the target\'s matching buffs; a buff with none left comes off.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    ...BUFF_MATCH_PARAMS,
    stacks: { kind: 'formula' as const, default: '1', description: 'Stacks to take off each matching buff.' }
  }
  static readonly SENTENCE: string = 'Take {stacks} stacks off[ {buff}][ buffs tagged {tag}] on the {who}'
  static readonly GROUP: EffectGroup | null = CONDITIONS
  static readonly ICON: string = 'Layers'

  handle(event: ActionEvent): void {
    const { buffs, found, words } = matchedBuffs(event.target, this.params)
    const name = event.target?.named ?? 'No one'
    const take = Math.max(0, Math.round(this.value(String(this.params.stacks), event)))
    if (!buffs || !found.length || !take) return this.report(event, { stacks: 0 }, `${name} has no ${words} to take stacks from.`)
    for (const b of found) {
      b.stacks -= take
      if (b.stacks <= 0) buffs.removeBuff(b)
    }
    this.report(event, { stacks: take }, `${take} stack${take === 1 ? '' : 's'} taken off ${buffLinks(found)} on ${name}.`)
    this.next(event)
  }
}

registerComponent(RemoveStacks)
