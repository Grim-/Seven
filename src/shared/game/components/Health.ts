import { evaluate, registerComponent, type GameEntity } from '../core'
import { Resource } from './Resource'
import { Stats } from './Stats'

export interface Hit {
  type: string
  cause: string
  source: GameEntity | null
  continuous?: boolean
}

export class Health extends Resource {
  static readonly type: string = 'health'
  static readonly DESCRIPTION: string = 'The resource that, at zero, kills the entity. Damage is resolved through the damage formula in data, using the damage type and the target\'s resist.'
  private dead = false
  private cause: string | null = null

  get isDead(): boolean {
    return this.dead
  }

  resolve(amount: number, hit: Hit): number {
    const entity = this.entity
    const type = entity?.catalog.damageType(hit.type)
    const formula = entity?.catalog.formula('damage')
    const resolved =
      !entity || !type || !formula
        ? amount
        : (() => {
            const resist = entity.comp(Stats)?.value(type.resistedBy) ?? 0
            const scale = type.scalesWith ? (hit.source?.comp(Stats)?.value(type.scalesWith) ?? 0) : 0
            const vars: Record<string, number> = { power: amount, resist, scalestat: scale, floor: hit.continuous ? 0 : 1 }
            return Math.max(0, evaluate(formula, { value: (name) => vars[name] }))
          })()
    return Math.max(0, entity ? entity.modifyIncomingDamage(resolved, hit) : resolved)
  }

  damage(amount: number, hit: Hit): number {
    const entity = this.entity
    if (this.dead || !entity) return 0
    const before = this.get()
    this.set(before - this.resolve(amount, hit))
    const dealt = before - this.get()
    if (dealt > 0) {
      const payload = { amount: dealt, type: hit.type, cause: hit.cause, source: hit.source?.uid ?? null }
      entity.emit('OnHealthLost', payload)
      entity.emit('OnHurt', payload)
      hit.source?.emit('OnDamageDealt', { ...payload, target: entity.uid })
    }
    if (this.get() <= 0) this.kill(hit.cause)
    return dealt
  }

  heal(amount: number, cause: string): number {
    const entity = this.entity
    if (this.dead || !entity) return 0
    const done = this.change(amount)
    if (done > 0) entity.emit('OnHealed', { amount: done, cause })
    return done
  }

  kill(cause: string | null): void {
    if (this.dead) return
    this.entity?.emit('OnBeforeDeath', { cause })
    if (this.dead || this.get() > 0) return
    this.dead = true
    this.cause = cause
    this.set(0)
    this.entity?.emit('OnDeath', { cause })
  }

  revive(fraction: number): void {
    if (!this.dead && this.get() > 0) return
    this.dead = false
    this.cause = null
    this.set(Math.max(1, this.max() * fraction))
    this.entity?.emit('OnRevived', { fraction })
  }

  tickSim(seconds: number): void {
    if (this.dead) return
    super.tickSim(seconds)
  }

  protected saveState(): Record<string, unknown> {
    return { ...super.saveState(), dead: this.dead, cause: this.cause }
  }

  protected loadState(state: Record<string, unknown>): void {
    super.loadState(state)
    this.dead = state.dead === true
    this.cause = typeof state.cause === 'string' ? state.cause : null
  }
}

registerComponent(Health)
