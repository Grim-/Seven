import { registerComponent } from '../../core'
import type { ActionEvent } from '../Action'
import { WorldPiece } from './WorldPiece'

export class UpdateFaction extends WorldPiece {
  static readonly type: string = 'world.updateFaction'
  static readonly DESCRIPTION: string = 'Updates a world faction’s power, default stance, or leader in the active save.'
  static readonly PARAMS = {
    ...WorldPiece.PARAMS_BASE,
    faction: { kind: 'worldFaction' as const, default: '', description: 'Which world faction.' },
    change: {
      kind: 'choice' as const,
      choices: ['adjustPower', 'setPower', 'setStance', 'setLeader'],
      labels: { adjustPower: 'adjust power by', setPower: 'set power to', setStance: 'set default stance to', setLeader: 'set leader to' },
      default: 'adjustPower',
      description: 'What to update on the faction in this save.'
    },
    value: { kind: 'text' as const, default: '1', description: 'Number for power, stance (allied/friendly/neutral/unfriendly/hostile), or sheet ID for leader.' }
  }
  static readonly SENTENCE: string = 'Update {faction}: {change} {value}'
  static readonly ICON: string = 'Shield'
  static readonly AIMS: boolean = false

  handle(event: ActionEvent): void {
    const p = this.params
    this.send(event, 'update_faction', { faction: p.faction, change: p.change, value: p.value })
    this.report(event, {}, `Updated faction ${String(p.faction)} (${String(p.change)}: ${String(p.value)}).`)
    this.next(event)
  }
}

registerComponent(UpdateFaction)
