import { registerComponent, test, type Component, type ConditionDef, type GameEntity } from '../core'
import { Action, type EffectLane } from './Action'
import { Stats } from './Stats'

export class Reaction extends Action {
  static readonly type: string = 'reaction'
  static readonly DESCRIPTION: string = 'Runs its pieces when the entity gets a signal and the condition holds, e.g. a skeleton that dies to any Holy damage.'
  static readonly PARAMS = {
    id: { kind: 'text' as const, default: '', description: 'Name of this reaction.' },
    signal: { kind: 'text' as const, default: 'OnHurt', description: 'Signal on the entity that starts it.' },
    when: { kind: 'list' as const, default: [], description: 'Conditions that must all hold. Fields of the signal are checked with `is`.' },
    target: { kind: 'choice' as const, default: 'self', choices: ['self', 'source'], description: 'Who its pieces act on.' }
  }
  static readonly LANES: EffectLane[] = [{ event: 'OnUse', label: 'When it reacts' }]

  canApply(host: GameEntity | Component): true | string {
    return 'catalog' in host ? true : 'a reaction belongs on an entity'
  }

  onApplied(): void {
    super.onApplied()
    const self = this.entity
    if (!self) return
    this.bind(self, String(this.params.signal), (payload) => {
      const ok = (this.params.when as ConditionDef[]).every((def) => test(def, { self, payload, seed: `${self.uid}:${this.id}:${this.uses}`, stat: (who, id) => who.comp(Stats)?.value(id) ?? 0 }))
      if (!ok) return
      const source = typeof payload.source === 'string' ? (self.world?.find(payload.source) ?? null) : null
      const target = this.params.target === 'source' ? source : self
      this.fire('OnUse', { user: source ?? self, target, at: null, distance: 0 }, payload)
    })
  }
}

registerComponent(Reaction)
