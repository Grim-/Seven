import { registerComponent } from '../core'
import { Action, type EffectLane } from './Action'

export class WorldEffects extends Action {
  static readonly type: string = 'world_effects'
  static readonly LABEL: string = 'World Effects'
  static readonly ICON: string = 'Globe'
  static readonly DESCRIPTION: string = 'World-level consequences for world events and triggers.'
  static readonly PARAMS = {
    id: { kind: 'text' as const, default: 'world_effects', description: 'Names the run for its dice seeds.' }
  }
  static readonly LANES: EffectLane[] = [{ event: 'OnUse', label: 'When it happens' }]
}

registerComponent(WorldEffects)
