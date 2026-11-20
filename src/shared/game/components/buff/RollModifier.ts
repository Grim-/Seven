import { registerComponent, type TooltipRow } from '../../core'
import { BuffPiece } from '../Buffs'

/** Modifies incoming or outgoing attack rolls (advantage / disadvantage) while the buff or trait is active. */
export class RollModifier extends BuffPiece {
  static readonly type: string = 'buff.rollModifier'
  static readonly DESCRIPTION: string = 'Grants advantage or disadvantage on incoming or outgoing attack rolls.'
  static readonly PARAMS = {
    scope: {
      kind: 'choice' as const,
      choices: ['incoming', 'outgoing'],
      labels: { incoming: 'attacks against holder', outgoing: 'attacks made by holder' },
      default: 'incoming',
      description: 'Which rolls are modified.'
    },
    mode: {
      kind: 'choice' as const,
      choices: ['advantage', 'disadvantage'],
      default: 'disadvantage',
      description: 'Roll twice taking higher (advantage) or lower (disadvantage).'
    }
  }
  static readonly SENTENCE: string = '{mode} on {scope}'
  static readonly ICON: string = 'ShieldAlert'

  rollFlags(scope: 'incoming' | 'outgoing'): { advantage: boolean; disadvantage: boolean } {
    if (!this.isHostActive || String(this.params.scope) !== scope) {
      return { advantage: false, disadvantage: false }
    }
    const mode = String(this.params.mode)
    return { advantage: mode === 'advantage', disadvantage: mode === 'disadvantage' }
  }

  tooltipRows(): TooltipRow[] {
    return [{ label: 'Roll', value: `${String(this.params.mode)} (${String(this.params.scope)})` }]
  }
}

registerComponent(RollModifier)
