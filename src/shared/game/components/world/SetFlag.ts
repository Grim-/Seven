import { registerComponent } from '../../core'
import type { ActionEvent } from '../Action'
import { registerLegacyTriggerAction } from '../../triggerActions'
import { WorldPiece } from './WorldPiece'

export class SetFlag extends WorldPiece {
  static readonly type: string = 'world.setFlag'
  static readonly DESCRIPTION: string = 'Sets or clears a flag: on the world, for triggers and stories to check, or on whoever it acts on, such as a map object whose states follow its own flags.'
  static readonly PARAMS = {
    ...WorldPiece.PARAMS_BASE,
    flag: { kind: 'text' as const, default: '', description: 'The flag.' },
    value: { kind: 'text' as const, default: 'true', description: 'Its value. Empty clears it.' },
    scope: { kind: 'choice' as const, choices: ['world', 'own'], default: 'world', description: 'world: the save\'s flags. own: the own flags of whoever it acts on.' }
  }
  static readonly SENTENCE: string = 'Set {scope} flag {flag} to {value}'
  static readonly ICON: string = 'Flag'

  handle(event: ActionEvent): void {
    const p = this.params
    this.send(event, 'set_flag', { flag: p.flag, value: p.value, scope: p.scope })
    this.report(event, {}, String(p.value) ? `Flag ${String(p.flag)} set to ${String(p.value)}.` : `Flag ${String(p.flag)} cleared.`)
    this.next(event)
  }
}

registerComponent(SetFlag)
registerLegacyTriggerAction('set_flag', (p) => [{ type: SetFlag.type, flag: String(p.flag ?? ''), value: p.operation === 'clear' ? '' : String(p.value ?? 'true'), scope: 'world' }])
