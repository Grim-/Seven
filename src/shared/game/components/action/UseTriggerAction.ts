import { REUSE, type EffectGroup } from '../../effectGroups'
import { registerComponent, type TooltipRow } from '../../core'
import { ActionPiece, type ActionEvent } from '../Action'
import { USE_TRIGGER_ACTION } from './storedPiece'

export class UseTriggerAction extends ActionPiece {
  static readonly type: string = USE_TRIGGER_ACTION
  static readonly DESCRIPTION: string = 'Runs a stored trigger action, so one list of effects can be used in many places.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    action: { kind: 'storedAction' as const, default: '', description: 'Which trigger action.' }
  }
  static readonly SENTENCE: string = 'Do {action} to the {who}'
  static readonly GROUP: EffectGroup | null = REUSE
  static readonly ICON: string = 'Link'

  tooltipRows(): TooltipRow[] {
    return [{ label: 'Does', value: String(this.params.action) || 'nothing' }]
  }

  handle(event: ActionEvent): void {
    const id = String(this.params.action)
    if (id && event.runStored?.(id, event)) this.next(event)
  }
}

registerComponent(UseTriggerAction)
