import { registerComponent } from '../../core'
import type { ActionEvent } from '../Action'
import { registerLegacyTriggerAction } from '../../triggerActions'
import { WorldPiece } from './WorldPiece'

export class Cue extends WorldPiece {
  static readonly type: string = 'world.cue'
  static readonly DESCRIPTION: string = 'Plays a sound or shows a message in the world view.'
  static readonly PARAMS = {
    ...WorldPiece.PARAMS_BASE,
    message: { kind: 'text' as const, default: '', description: 'Text shown.' },
    sound: { kind: 'text' as const, default: '', description: 'A sound to play.' }
  }
  static readonly SENTENCE: string = 'Show {message}[ and play {sound}]'
  static readonly ICON: string = 'Volume2'
  static readonly AIMS: boolean = false

  handle(event: ActionEvent): void {
    const p = this.params
    this.send(event, 'cue', { message: p.message, sound: p.sound })
    this.report(event, {}, String(p.message))
    this.next(event)
  }
}

registerComponent(Cue)
registerLegacyTriggerAction('play_cue', (p) => [{ type: Cue.type, message: String(p.message ?? ''), sound: String(p.sound ?? '') }])
