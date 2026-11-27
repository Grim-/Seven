import { entryLink, registerComponent } from '../../core'
import type { ActionEvent } from '../Action'
import { WorldPiece } from './WorldPiece'

export class MoveCharacter extends WorldPiece {
  static readonly type: string = 'world.moveCharacter'
  static readonly DESCRIPTION: string = 'Moves a character sheet to another place in the active save.'
  static readonly PARAMS = {
    ...WorldPiece.PARAMS_BASE,
    character: { kind: 'entry' as const, entryKind: 'sheet', default: '', description: 'Which character to move.' },
    place: { kind: 'worldPlace' as const, default: '', description: 'Where they move to.' }
  }
  static readonly SENTENCE: string = 'Move {character} to {place}'
  static readonly ICON: string = 'Footprints'
  static readonly AIMS: boolean = false

  handle(event: ActionEvent): void {
    const p = this.params
    this.send(event, 'move_character', { character: p.character, place: p.place })
    this.report(event, {}, `Moved ${entryLink('sheet', String(p.character))} to ${String(p.place)}.`)
    this.next(event)
  }
}

registerComponent(MoveCharacter)
