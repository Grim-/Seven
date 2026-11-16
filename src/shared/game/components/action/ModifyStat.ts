import { CONDITIONS, type EffectGroup } from '../../effectGroups'
import { registerComponent } from '../../core'
import { ActionPiece, type ActionEvent } from '../Action'
import { Stats } from '../Stats'

const STAT_MODES: Record<string, (base: number, val: number) => number> = {
  add: (base, val) => base + val,
  set: (_base, val) => val,
  multiply: (base, val) => base * val
}

export class ModifyStat extends ActionPiece {
  static readonly type: string = 'action.modifyStat'
  static readonly DESCRIPTION: string = 'Permanently alters a base stat on the target (add, set, or multiply).'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    stat: { kind: 'template' as const, templateKind: 'stat', default: '', description: 'Which stat to update.' },
    mode: {
      kind: 'choice' as const,
      choices: Object.keys(STAT_MODES),
      labels: { add: 'add', set: 'set to', multiply: 'multiply by' },
      default: 'add',
      description: 'How the base value is updated.'
    },
    amount: { kind: 'formula' as const, default: '1', description: 'Value or formula used by the update.' }
  }
  static readonly SENTENCE: string = '{mode} {stat} on the {who} by {amount}'
  static readonly GROUP: EffectGroup | null = CONDITIONS
  static readonly ICON: string = 'SlidersHorizontal'

  handle(event: ActionEvent): void {
    const stat = String(this.params.stat ?? '').trim()
    const stats = event.target?.comp(Stats)
    const name = event.target?.named ?? 'No one'
    if (!stat || !stats) return this.report(event, { updated: 0 }, `${name} cannot update ${stat || 'stat'}.`)
    const before = stats.baseValue(stat)
    const val = this.value(String(this.params.amount ?? '0'), event)
    const fn = STAT_MODES[String(this.params.mode || 'add')] ?? STAT_MODES.add
    const next = Math.round(fn(before, val) * 100) / 100
    stats.setBase(stat, next)
    this.report(event, { stat, before, after: next }, `${name}'s ${stat} changed from ${before} to ${next}.`)
    this.next(event)
  }
}

registerComponent(ModifyStat)
