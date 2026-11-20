import { evaluate, rollInt, type Component, type GameEntity } from '../core'

export interface RefillRule {
  on: string[]
  fraction: number
  dice: string
  rechargeAt: number
}

export interface Pool {
  max(): number
  get(): number
  change(amount: number): number
  refillable(): boolean
}

export function bindRefills(comp: Component, entity: GameEntity, rule: RefillRule, pool: Pool): void {
  let n = 0
  const die = (sides: number) => rollInt(entity.uid, `${comp.uid}:${entity.at ?? 0}:${n++}`, 1, sides)
  const dice = (): number => {
    if (!rule.dice.trim()) return 0
    return evaluate(rule.dice, {
      value: () => undefined,
      dice: (count, sides) => {
        let total = 0
        for (let i = 0; i < count; i++) total += die(sides)
        return total
      }
    })
  }
  for (const signal of rule.on) {
    if (signal) comp.bind(entity, signal, () => {
      if (pool.refillable()) pool.change(pool.max() * rule.fraction + dice())
    })
  }
  if (rule.rechargeAt > 0) {
    comp.bind(entity, 'OnTurnStart', () => {
      if (pool.refillable() && pool.get() < pool.max() && die(6) >= rule.rechargeAt) pool.change(pool.max())
    })
  }
}

export const NO_REFILL: RefillRule = { on: [], fraction: 0, dice: '', rechargeAt: 0 }

export const REFILL_PARAMS = {
  refillOn: { kind: 'list' as const, default: [], of: { kind: 'signal' as const, default: '', description: 'A signal that refills it, such as On Long Rest.' }, description: 'Signals that refill it: On Turn Start, On Short Rest, On Long Rest, On Dawn.', section: 'Refill' },
  refillFraction: { kind: 'number' as const, default: 1, min: 0, max: 1, description: 'Share of its maximum each refill gives back: 1 all, 0.5 half.', section: 'Refill' },
  refillDice: { kind: 'formula' as const, default: '', description: 'Dice added to each refill, such as 1d6 + 1.', section: 'Refill' },
  rechargeAt: { kind: 'number' as const, default: 0, min: 0, max: 6, description: 'Recharge roll: at the start of its turn a d6 of this or higher refills it. 0 for none.', section: 'Refill' }
}

export function refillRule(v: Record<string, unknown>): RefillRule {
  return {
    on: Array.isArray(v.refillOn) ? v.refillOn.map(String).filter(Boolean) : [],
    fraction: Number(v.refillFraction) || 0,
    dice: typeof v.refillDice === 'string' ? v.refillDice : '',
    rechargeAt: Number(v.rechargeAt) || 0
  }
}
