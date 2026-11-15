import { entryLink, registerComponent } from '../../core'
import type { ActionEvent } from '../Action'
import { registerLegacyTriggerAction } from '../../triggerActions'
import { WorldPiece } from './WorldPiece'

export class ChangeWorld extends WorldPiece {
  static readonly type: string = 'world.changeWorld'
  static readonly DESCRIPTION: string = 'Moves whoever it acts on into another world.'
  static readonly PARAMS = {
    ...WorldPiece.PARAMS_BASE,
    world: { kind: 'entry' as const, entryKind: 'world', default: '', description: 'The world to go to.' },
    map: { kind: 'entry' as const, entryKind: 'map', default: '', description: 'The map of that world to arrive on. Empty uses its first map.' }
  }
  static readonly SENTENCE: string = 'Send the {who} to the world {world}[, arriving on {map}]'
  static readonly ICON: string = 'Globe'

  handle(event: ActionEvent): void {
    const p = this.params
    this.send(event, 'change_world', { world: p.world, map: p.map })
    this.report(event, {}, `Goes to ${entryLink('world', String(p.world))}.`)
    this.next(event)
  }
}

registerComponent(ChangeWorld)
registerLegacyTriggerAction('change_world', (p) => [{ type: ChangeWorld.type, world: String(p.world ?? ''), map: String(p.map ?? '') }])
