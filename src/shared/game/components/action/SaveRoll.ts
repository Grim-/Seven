import { chanceOf } from '../../../actions'
import { LUCK, type EffectGroup } from '../../effectGroups'
import { registerComponent, rollInt, type TooltipRow } from '../../core'
import { checkBonus, contest, rollCheck, rollLine } from '../../rules'
import { ActionPiece, chainScore, expectedActionValue, type ActionEvent, type EffectBranch, type UseContext } from '../Action'

/** Requires the target to roll an editable CheckDef against the caster's DC formula. */
export class SaveRoll extends ActionPiece {
  static readonly type: string = 'action.saveRoll'
  static readonly DESCRIPTION: string = 'Target rolls a check against a DC. On failed save sends its event, otherwise sends `onFail`.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    check: { kind: 'template' as const, templateKind: 'check', default: 'dex', description: 'Check the target rolls to resist.' },
    dc: { kind: 'formula' as const, default: '10 + floor((user.int - 10) / 2)', description: 'Difficulty Class the target must meet or beat to save.' },
    onFail: { kind: 'text' as const, default: '', description: 'Event sent when the target succeeds on its save. Empty sends nothing.' }
  }
  static readonly SENTENCE: string = '{who} makes {check} save vs DC {dc}'
  static readonly GROUP: EffectGroup | null = LUCK
  static readonly ICON: string = 'ShieldQuestion'
  static readonly BRANCHES: EffectBranch[] = [
    { param: 'emit', label: 'Failed save', tone: 'pass', always: true },
    { param: 'onFail', label: 'Saved', tone: 'fail', always: true }
  ]

  tooltipRows(): TooltipRow[] {
    const id = String(this.params.check || '')
    const label = this.entity?.catalog.check(id)?.label ?? id
    return [{ label: 'Save', value: `${label} vs DC ${String(this.params.dc)}` }]
  }

  handle(event: ActionEvent): void {
    const target = event.target
    if (!target) return
    const checkId = String(this.params.check || '')
    const checkDef = event.user.catalog.check(checkId) ?? event.user.catalog.checks()[0]
    if (!checkDef) return this.next(event)
    const dc = Math.round(this.value(String(this.params.dc || '0'), event))
    let n = 0
    const res = rollCheck(target, checkDef, (sides) => rollInt(target.uid, `${this.seed(event)}:${n++}`, 1, sides))
    const saved = contest(res, { dc }).passed
    this.report(
      event,
      { roll: res.total, dc, saved: saved ? 1 : 0 },
      `${rollLine(target.named, res)} against DC ${dc}: ${saved ? 'saved' : 'failed save'}.`
    )
    if (!saved) return this.next(event)
    this.branch(event, String(this.params.onFail))
  }

  score(ctx: UseContext): number {
    const failEffect = chainScore(this.action, String(this.params.emit), ctx)
    const saveEffect = chainScore(this.action, String(this.params.onFail), ctx)
    if (!this.action || !ctx.target || (failEffect <= 0 && saveEffect <= 0)) return 0
    const checkDef = ctx.user.catalog.check(String(this.params.check || ''))
    const dc = expectedActionValue(String(this.params.dc || '0'), { ...ctx, action: this.action })
    const bonus = checkDef ? checkBonus(ctx.target, checkDef) : 0
    const pSave = chanceOf(bonus, dc)
    return failEffect * (1 - pSave) + saveEffect * pSave
  }
}

registerComponent(SaveRoll)
