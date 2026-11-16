import { registerComponent, test, type Component, type ConditionDef, type GameEntity } from '../core'
import { Action, MAX_CHAIN_DEPTH, type EffectLane } from './Action'
import { Buff, isPassiveHost } from './Buffs'
import { Stats } from './Stats'

export class Reaction extends Action {
  static readonly type: string = 'reaction'
  static readonly DESCRIPTION: string = 'Runs its pieces when the entity gets a signal and the condition holds, e.g. a skeleton that dies to any Holy damage.'
  static readonly PARAMS = {
    id: { kind: 'text' as const, default: '', description: 'Name of this reaction.' },
    signal: { kind: 'signal' as const, default: 'OnHurt', description: 'Signal on the entity that starts it.' },
    when: { kind: 'conditions' as const, default: [], description: 'Conditions that must all hold. Fields of the signal are checked with `is`.' },
    target: { kind: 'choice' as const, default: 'self', choices: ['self', 'source', 'triggerTarget'], description: 'Who its pieces act on.' }
  }
  static readonly LANES: EffectLane[] = [{ event: 'OnUse', label: 'When it reacts' }]

  canApply(host: GameEntity | Component): true | string {
    return 'catalog' in host || host instanceof Buff || isPassiveHost(host) ? true : 'a reaction belongs on an entity, buff, or trait'
  }

  onApplied(): void {
    super.onApplied()
    const self = this.entity
    if (!self) return
    this.bind(self, String(this.params.signal), (payload) => {
      if (isPassiveHost(this.parent) && !this.parent.isActive()) return
      const chainDepth = typeof payload.chainDepth === 'number' ? payload.chainDepth : 0
      if (chainDepth >= MAX_CHAIN_DEPTH) return
      const ok = (this.params.when as ConditionDef[]).every((def) => test(def, { self, payload, seed: `${self.uid}:${this.id}:${this.uses}`, stat: (who, id) => who.comp(Stats)?.value(id) ?? 0 }))
      if (!ok) return
      const source = typeof payload.source === 'string' ? (self.world?.find(payload.source) ?? null) : null
      const triggerTarget = typeof payload.target === 'string' ? (self.world?.find(payload.target) ?? null) : null
      const targets: Record<string, GameEntity | null> = { self, source, triggerTarget }
      const target = targets[String(this.params.target)] ?? self
      this.fire('OnUse', { user: source ?? self, target, at: null, distance: 0, chainDepth }, payload)
    })
  }
}

registerComponent(Reaction)
