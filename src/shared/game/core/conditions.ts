import type { GameEntity } from './GameEntity'
import { roll } from './rng'

export interface ConditionDef {
  type: string
  [field: string]: unknown
}

export interface ConditionContext {
  self: GameEntity
  payload: Record<string, unknown>
  seed: string
  stat: (who: GameEntity, id: string) => number
}

type Check = (def: ConditionDef, ctx: ConditionContext) => boolean

const checks = new Map<string, Check>()

export function registerCondition(type: string, check: Check): void {
  checks.set(type, check)
}

export function conditionTypes(): string[] {
  return [...checks.keys()]
}

export function test(def: ConditionDef | null | undefined, ctx: ConditionContext): boolean {
  if (!def) return true
  const check = checks.get(def.type)
  return check ? check(def, ctx) : false
}

const list = (v: unknown): ConditionDef[] => (Array.isArray(v) ? (v as ConditionDef[]) : [])

registerCondition('all', (def, ctx) => list(def.of).every((d) => test(d, ctx)))
registerCondition('any', (def, ctx) => list(def.of).some((d) => test(d, ctx)))
registerCondition('not', (def, ctx) => !test(def.of as ConditionDef, ctx))
registerCondition('chance', (def, ctx) => roll(ctx.seed, String(def.salt ?? 'chance')) * 100 < Number(def.percent ?? 0))
registerCondition('stat', (def, ctx) => {
  const v = ctx.stat(ctx.self, String(def.stat))
  return v >= Number(def.min ?? -Infinity) && v <= Number(def.max ?? Infinity)
})
registerCondition('is', (def, ctx) => ctx.payload[String(def.field)] === def.value)
