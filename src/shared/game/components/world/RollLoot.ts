import { entryLink, registerComponent } from '../../core'
import type { ActionEvent } from '../Action'
import { registerLegacyTriggerAction } from '../../triggerActions'
import { WorldPiece } from './WorldPiece'

export class RollLoot extends WorldPiece {
  static readonly type: string = 'world.rollLoot'
  static readonly DESCRIPTION: string = 'Rolls a loot table and gives what comes up to whoever it acts on.'
  static readonly PARAMS = {
    ...WorldPiece.PARAMS_BASE,
    table: { kind: 'entry' as const, entryKind: 'loot_table', default: '', description: 'Which loot table.' }
  }
  static readonly SENTENCE: string = 'Roll on {table} and give it to the {who}'
  static readonly ICON: string = 'Gem'

  handle(event: ActionEvent): void {
    const p = this.params
    this.send(event, 'roll_loot', { table: p.table })
    this.report(event, {}, `Rolls on ${entryLink('loot_table', String(p.table))}.`)
    this.next(event)
  }
}

registerComponent(RollLoot)
registerLegacyTriggerAction('roll_loot_table', (p) => [{ type: RollLoot.type, table: String(p.tableId ?? '') }])
