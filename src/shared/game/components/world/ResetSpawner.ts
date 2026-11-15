import { registerComponent } from '../../core'
import type { ActionEvent } from '../Action'
import { registerLegacyTriggerAction } from '../../triggerActions'
import { WorldPiece } from './WorldPiece'

export class ResetSpawner extends WorldPiece {
  static readonly type: string = 'world.resetSpawner'
  static readonly DESCRIPTION: string = 'Resets a spawner on the map so it spawns again.'
  static readonly PARAMS = {
    ...WorldPiece.PARAMS_BASE,
    spawner: { kind: 'text' as const, default: '', description: 'Which spawner. Empty resets them all.' }
  }
  static readonly SENTENCE: string = 'Reset {spawner}'
  static readonly ICON: string = 'RefreshCcw'
  static readonly AIMS: boolean = false

  handle(event: ActionEvent): void {
    const p = this.params
    this.send(event, 'reset_spawner', { spawner: p.spawner })
    this.report(event, {}, p.spawner ? `Spawner ${String(p.spawner)} reset.` : 'Spawners reset.')
    this.next(event)
  }
}

registerComponent(ResetSpawner)
registerLegacyTriggerAction('reset_spawner', (p) => [{ type: ResetSpawner.type, spawner: String(p.spawnerId ?? '') }])
