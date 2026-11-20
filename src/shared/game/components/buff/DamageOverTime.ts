import { HARM, type EffectGroup } from '../../effectGroups'
import { evaluate, registerComponent, rollInt, type GameEntity } from '../../core'
import { BuffPiece } from '../Buffs'
import { Health } from '../Health'
import { Stats } from '../Stats'

const SCALING: Record<string, (base: number, value: number, neutral: number) => number> = {
  times: (base, value) => base * value,
  more: (base, value, neutral) => (base * value) / neutral,
  less: (base, value, neutral) => (base * neutral) / Math.max(value, neutral / 100)
}

export class DamageOverTime extends BuffPiece {
  static readonly type: string = 'buff.damageOverTime'
  static readonly DESCRIPTION: string = 'Damages the holder while the buff lasts: one hit every `every` seconds, or each time the holder gets the `on` signal (such as On Turn Start).'
  static readonly PARAMS = {
    damageType: { kind: 'template' as const, templateKind: 'damage_type', default: '', description: 'What the damage counts as.' },
    perHit: { kind: 'formula' as const, default: '', description: 'Damage per hit, such as 1d4 or 1d6 + user.int (user: who applied it, target: who has it). Empty uses the buff strength.' },
    every: { kind: 'duration' as const, default: 0, min: 0, description: 'Time between hits. 0 hits every tick.' },
    on: { kind: 'signal' as const, default: '', description: 'Signal on the holder that makes a hit, such as On Turn Start or On Turn End. Empty uses every.' },
    scalingStat: { kind: 'template' as const, templateKind: 'stat', default: '', description: 'Holder stat the damage scales with. Empty for none.' },
    scaling: {
      kind: 'choice' as const,
      choices: Object.keys(SCALING),
      labels: { times: 'multiplied by', more: 'proportional to', less: 'inversely proportional to' },
      default: 'times',
      description: 'How the damage follows the stat. Multiplied by: damage × stat. Proportional to: damage × stat ÷ the stat\'s default, so a stat above its default does more. Inversely proportional to: damage × default ÷ stat, so a stat below its default does more (poison against Constitution).'
    }
  }
  static readonly SENTENCE: string = 'Deal {perHit} {damageType} damage to the holder[ every {every}][ on {on}][, {scaling} {scalingStat}]'
  static readonly GROUP: EffectGroup | null = HARM
  static readonly ICON: string = 'Droplets'

  private rolled(): number {
    const source = String(this.params.perHit).trim()
    if (!source || source === '0') return this.strength
    const holder = this.entity
    const caster = this.buff?.source ? (holder?.world?.find(this.buff.source) ?? null) : null
    const stat = (who: GameEntity | null | undefined, id: string) => (who ? who.comp(Stats)?.value(id) : undefined)
    const who: Record<string, GameEntity | null | undefined> = { user: caster, target: holder }
    let n = 0
    return evaluate(source, {
      value: (name) => {
        if (name === 'strength') return this.strength
        if (name === 'stacks') return this.buff?.stacks ?? 1
        const [side, id] = name.split('.')
        return side in who ? (stat(who[side], id) ?? 0) : undefined
      },
      dice: (count, sides) => {
        let total = 0
        for (let i = 0; i < count; i++) total += rollInt(holder?.uid ?? 'holder', `${this.uid}:${this.buff?.elapsed ?? 0}:${n++}`, 1, sides)
        return total
      }
    })
  }

  private amount(): number {
    const base = Math.max(0, this.rolled())
    const stat = String(this.params.scalingStat)
    const stats = this.entity?.comp(Stats)
    if (!stat || !stats) return base
    const neutral = this.entity?.catalog.stat(stat)?.default ?? 1
    return (SCALING[String(this.params.scaling)] ?? SCALING.times)(base, stats.value(stat), neutral > 0 ? neutral : 1)
  }

  private hit(): void {
    const entity = this.entity
    const health = entity?.comp(Health)
    if (!entity || !health || health.isDead) return
    const source = this.buff?.source ? (entity.world?.find(this.buff.source) ?? null) : null
    health.damage(this.amount(), { type: String(this.params.damageType), cause: this.buff?.id ?? 'buff', source, continuous: true })
  }

  onApplied(): void {
    super.onApplied()
    const signal = String(this.params.on)
    if (signal && this.entity) this.bind(this.entity, signal, () => this.hit())
  }

  tickSim(seconds: number): void {
    super.tickSim(seconds)
    if (!String(this.params.on)) this.repeatEvery('hit', Number(this.params.every), seconds, () => this.hit())
  }
}

registerComponent(DamageOverTime)
