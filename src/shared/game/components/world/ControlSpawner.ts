import { registerComponent } from '../../core'
import type { ActionEvent } from '../Action'
import { WorldPiece } from './WorldPiece'

export class ControlSpawner extends WorldPiece {
  static readonly type: string = 'world.controlSpawner'
  static readonly DESCRIPTION: string = 'Activates, spawns now, disables, or resets a creature spawner in the active save.'
  static readonly PARAMS = {
    ...WorldPiece.PARAMS_BASE,
    spawner: { kind: 'worldSpawner' as const, default: '', description: 'Which spawner on a world map.' },
    mode: {
      kind: 'choice' as const,
      choices: ['activate', 'spawnNow', 'disable', 'reset'],
      labels: { activate: 'activate', spawnNow: 'spawn now', disable: 'disable', reset: 'reset' },
      default: 'activate',
      description: 'What happens to the spawner.'
    }
  }
  static readonly SENTENCE: string = '{mode} spawner {spawner}'
  static readonly ICON: string = 'Skull'
  static readonly AIMS: boolean = false

  handle(event: ActionEvent): void {
    const p = this.params
    this.send(event, 'control_spawner', { spawner: p.spawner, mode: p.mode })
    this.report(event, {}, `Spawner ${String(p.spawner)}: ${String(p.mode)}.`)
    this.next(event)
  }
}

registerComponent(ControlSpawner)
