import { registerComponent } from '../core'
import { Action, type EffectLane } from './Action'

export class Effects extends Action {
  static readonly type: string = 'effects'
  static readonly LABEL: string = 'Effects'
  static readonly ICON: string = 'Zap'
  static readonly DESCRIPTION: string = 'A list of effects run on their own, such as a card on a hit or a stored trigger action.'
  static readonly PARAMS = { id: { kind: 'text' as const, default: 'effects', description: 'Names the run for its dice seeds.' } }
  static readonly LANES: EffectLane[] = [{ event: 'OnUse', label: 'When it happens' }]
}

registerComponent(Effects)
