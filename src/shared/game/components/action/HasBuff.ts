import { CONDITIONS, type EffectGroup } from '../../effectGroups'
import { registerComponent, type TooltipRow } from '../../core'
import { ActionPiece, type ActionEvent, type EffectBranch } from '../Action'
import { BUFF_MATCH_PARAMS, matchedBuffs } from './buffMatch'

export class HasBuff extends ActionPiece {
  static readonly type: string = 'action.hasBuff'
  static readonly DESCRIPTION: string = 'Checks whether the target has a buff, or any buff with a tag; goes on if it does, otherwise sends `onNo`.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    ...BUFF_MATCH_PARAMS,
    onNo: { kind: 'text' as const, default: '', description: 'Event sent when it does not. Empty sends nothing.' }
  }
  static readonly SENTENCE: string = 'If the {who} has[ {buff}][ a buff tagged {tag}]'
  static readonly GROUP: EffectGroup | null = CONDITIONS
  static readonly ICON: string = 'SearchCheck'
  static readonly BRANCHES: EffectBranch[] = [
    { param: 'emit', label: 'Has it', tone: 'pass', always: true },
    { param: 'onNo', label: 'Does not', tone: 'fail', always: true }
  ]

  tooltipRows(): TooltipRow[] {
    return [{ label: 'Needs', value: [String(this.params.buff), String(this.params.tag)].filter(Boolean).join(', ') || 'nothing set' }]
  }

  handle(event: ActionEvent): void {
    const { found, words } = matchedBuffs(event.target, this.params)
    const name = event.target?.named ?? 'No one'
    const has = found.length > 0
    this.report(event, { has }, `${name} ${has ? 'has' : 'does not have'} ${words}.`)
    if (has) return this.next(event)
    this.branch(event, String(this.params.onNo))
  }
}

registerComponent(HasBuff)
