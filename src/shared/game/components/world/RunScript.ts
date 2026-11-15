import { entryLink, registerComponent } from '../../core'
import type { ActionEvent } from '../Action'
import { registerLegacyTriggerAction } from '../../triggerActions'
import { WorldPiece } from './WorldPiece'

export class RunScript extends WorldPiece {
  static readonly type: string = 'world.runScript'
  static readonly DESCRIPTION: string = 'Runs a script.'
  static readonly PARAMS = {
    ...WorldPiece.PARAMS_BASE,
    script: { kind: 'entry' as const, entryKind: 'script', default: '', description: 'Which script.' }
  }
  static readonly SENTENCE: string = 'Run {script}'
  static readonly ICON: string = 'Code'
  static readonly AIMS: boolean = false

  handle(event: ActionEvent): void {
    const p = this.params
    this.send(event, 'script', { script: p.script })
    this.report(event, {}, `Runs ${entryLink('script', String(p.script))}.`)
    this.next(event)
  }
}

registerComponent(RunScript)
registerLegacyTriggerAction('script_call', (p) => [{ type: RunScript.type, script: String(p.scriptId ?? '') }])
