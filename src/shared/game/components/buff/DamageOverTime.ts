import { registerComponent } from '../../core'
import { BuffPiece } from '../Buffs'
import { Health } from '../Health'
import { Stats } from '../Stats'

export class DamageOverTime extends BuffPiece {
  static readonly type: string = 'buff.damageOverTime'
  static readonly DESCRIPTION: string = 'Damages the holder while the buff lasts: one hit every tick, or every `every` seconds.'
  static readonly PARAMS = {
    damageType: { kind: 'template' as const, templateKind: 'damage_type', default: '', description: 'What the damage counts as.' },
    perHit: { kind: 'number' as const, default: 0, min: 0, description: 'Damage per hit; 0 uses the buff strength.' },
    every: { kind: 'number' as const, default: 0, min: 0, description: 'Seconds between hits. 0 hits every tick.' },
    scalingStat: { kind: 'template' as const, templateKind: 'stat', default: '', description: 'Holder stat that multiplies the damage. Empty for none.' }
  }

  private amount(): number {
    const base = Number(this.params.perHit) > 0 ? Number(this.params.perHit) : this.strength
    const stat = String(this.params.scalingStat)
    return stat ? base * (this.entity?.comp(Stats)?.value(stat) ?? 1) : base
  }

  private hit(): void {
    const entity = this.entity
    const health = entity?.comp(Health)
    if (!entity || !health || health.isDead) return
    const source = this.buff?.source ? (entity.world?.find(this.buff.source) ?? null) : null
    health.damage(this.amount(), { type: String(this.params.damageType), cause: this.buff?.id ?? 'buff', source, continuous: true })
  }

  tickSim(seconds: number): void {
    super.tickSim(seconds)
    this.repeatEvery('hit', Number(this.params.every), seconds, () => this.hit())
  }
}

registerComponent(DamageOverTime)
