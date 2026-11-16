import { CONDITIONS, type EffectGroup } from '../../effectGroups'
import { registerComponent } from '../../core'
import { BuffPiece } from '../Buffs'

export class Invisible extends BuffPiece {
  static readonly type: string = 'buff.invisible'
  static readonly DESCRIPTION: string = 'Makes this entity or map object hidden from visibility checks while active.'
  static readonly PARAMS = {
    note: { kind: 'text' as const, default: '', description: 'Optional note describing this invisibility effect.' }
  }
  static readonly SENTENCE: string = 'Turn invisible'
  static readonly GROUP: EffectGroup | null = CONDITIONS
  static readonly ICON: string = 'EyeOff'

  isInvisible(): boolean {
    return this.isHostActive
  }
}

registerComponent(Invisible)
