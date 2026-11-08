import { registerComponent } from '../../core'
import { BuffPiece } from '../Buffs'

export class StatBonus extends BuffPiece {
  static readonly type: string = 'buff.statBonus'
  static readonly DESCRIPTION: string = 'Changes one stat or resist while the buff lasts, by `amount` times the buff strength.'
  static readonly PARAMS = {
    stat: { kind: 'template' as const, templateKind: 'stat', default: '', description: 'Which stat or resist.' },
    amount: { kind: 'number' as const, default: 1, description: 'Change per point of buff strength. Negative lowers it.' }
  }

  modifyStat(_domain: string, key: string, value: number): number {
    if (key !== this.params.stat) return value
    return value + Number(this.params.amount) * this.strength
  }
}

registerComponent(StatBonus)
