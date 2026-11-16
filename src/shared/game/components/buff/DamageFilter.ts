import { CONDITIONS, type EffectGroup } from '../../effectGroups'
import { registerComponent } from '../../core'
import { BuffPiece } from '../Buffs'
import type { Hit } from '../Health'

const FILTER_MODES: Record<string, (amount: number, n: number) => number> = {
  under: (amount, n) => (amount < n ? 0 : amount),
  atOrBelow: (amount, n) => (amount <= n ? 0 : amount),
  reduce: (amount, n) => Math.max(0, amount - n),
  cap: (amount, n) => Math.min(amount, n)
}

export class DamageFilter extends BuffPiece {
  static readonly type: string = 'buff.damageFilter'
  static readonly DESCRIPTION: string = 'Ignores small hits under a threshold, caps incoming hits, or reduces hit damage.'
  static readonly PARAMS = {
    mode: {
      kind: 'choice' as const,
      choices: Object.keys(FILTER_MODES),
      labels: {
        under: 'ignore under threshold',
        atOrBelow: 'ignore at or below threshold',
        reduce: 'reduce every hit by',
        cap: 'cap single hit at'
      },
      default: 'under',
      description: 'How incoming hit damage is filtered.'
    },
    amount: { kind: 'number' as const, default: 5, min: 0, description: 'Damage threshold, flat reduction, or cap.' },
    damageType: { kind: 'template' as const, templateKind: 'damage_type', default: '', description: 'Optional damage type filter. Empty applies to all damage.' }
  }
  static readonly SENTENCE: string = '{mode} {amount}[ {damageType}] damage'
  static readonly GROUP: EffectGroup | null = CONDITIONS
  static readonly ICON: string = 'Shield'

  modifyIncomingDamage(amount: number, hit: Hit): number {
    if (!this.isHostActive) return amount
    const wantedType = String(this.params.damageType ?? '').trim()
    if (wantedType && hit.type !== wantedType) return amount
    const n = Math.max(0, Number(this.params.amount ?? 0))
    const fn = FILTER_MODES[String(this.params.mode || 'under')] ?? FILTER_MODES.under
    return fn(amount, n)
  }
}

registerComponent(DamageFilter)
