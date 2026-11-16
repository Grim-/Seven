import { Buffs } from '../components/Buffs'
import { Health } from '../components/Health'
import { Equipment, Inventory, Item } from '../components/Inventory'
import { Progression } from '../components/Progression'
import { Stats } from '../components/Stats'
import { entityHasTag } from '../components/Tags'
import { Traits } from '../components/Traits'
import { registerCondition, test, type Component, type ConditionContext, type ConditionDef, type GameEntity } from '../core'

interface ClassQuery {
  hasClass(id: string, opts?: { minLevel?: number; activeOnly?: boolean }): boolean
  classLevel(id: string): number
}

function classComp(entity: GameEntity): (Component & Partial<ClassQuery>) | undefined {
  return entity.comps.find((c) => c.type === 'classes') as (Component & Partial<ClassQuery>) | undefined
}

export interface ConditionKindMeta {
  kind: string
  label: string
  description: string
}

export const CONDITION_KINDS: ConditionKindMeta[] = [
  { kind: 'level', label: 'Level', description: 'Character or class minimum/maximum level.' },
  { kind: 'class', label: 'Has Class', description: 'Requires an owned class (optionally active and minimum level).' },
  { kind: 'tag', label: 'Has Tag', description: 'Checks entity, active trait, class, or buff tags.' },
  { kind: 'trait', label: 'Has Trait', description: 'Checks whether a trait is present and active.' },
  { kind: 'healthPct', label: 'Health %', description: 'Checks current health percentage range.' },
  { kind: 'stat', label: 'Stat Check', description: 'Compares a stat value against a threshold.' },
  { kind: 'hasBuff', label: 'Has Buff', description: 'Checks for a buff by template id or tag.' },
  { kind: 'hasItem', label: 'Has Item', description: 'Checks inventory or equipped gear.' },
  { kind: 'storyFlag', label: 'Story Flag', description: 'Checks a campaign/story state flag or signal payload key.' },
  { kind: 'is', label: 'Signal Field', description: 'Checks a signal payload field equality.' },
  { kind: 'chance', label: 'Chance %', description: 'Deterministic seeded percent chance (0–100).' },
  { kind: 'all', label: 'All Of', description: 'Nested group where every child condition must pass.' },
  { kind: 'any', label: 'Any Of', description: 'Nested group where at least one child condition passes.' },
  { kind: 'not', label: 'Not', description: 'Inverts a child condition.' }
]

export function makeConditionContext(
  self: GameEntity,
  opts: { payload?: Record<string, unknown>; flags?: Record<string, unknown>; seed?: string } = {}
): ConditionContext {
  return {
    self,
    payload: opts.payload ?? {},
    flags: opts.flags,
    seed: opts.seed ?? self.uid,
    stat: (who, id) => who.comp(Stats)?.value(id) ?? 0
  }
}

registerCondition('level', (def, ctx) => {
  const clsId = String(def.class ?? '').trim()
  const actual = clsId ? (classComp(ctx.self)?.classLevel?.(clsId) ?? 0) : (ctx.self.comp(Progression)?.level ?? 1)
  if (def.min !== undefined && actual < Number(def.min)) return false
  if (def.max !== undefined && actual > Number(def.max)) return false
  return true
})

registerCondition('class', (def, ctx) => {
  const id = String(def.id ?? '').trim()
  if (!id) return false
  const cls = classComp(ctx.self)
  if (!cls || typeof cls.hasClass !== 'function') return false
  return cls.hasClass(id, {
    minLevel: def.minLevel !== undefined ? Number(def.minLevel) : undefined,
    activeOnly: def.activeOnly !== undefined ? Boolean(def.activeOnly) : false
  })
})

registerCondition('tag', (def, ctx) => {
  const tag = String(def.tag ?? '').trim()
  return tag ? entityHasTag(ctx.self, tag) : false
})

registerCondition('trait', (def, ctx) => {
  const id = String(def.id ?? '').trim()
  if (!id) return false
  const traits = ctx.self.comp(Traits)
  if (!traits) return false
  const activeOnly = def.activeOnly !== undefined ? Boolean(def.activeOnly) : true
  return activeOnly ? traits.hasActive(id) : traits.has(id)
})

registerCondition('healthPct', (def, ctx) => {
  const health = ctx.self.comp(Health)
  if (!health) return false
  const max = Math.max(1, health.max())
  const pct = (health.get() / max) * 100
  if (def.min !== undefined && pct < Number(def.min)) return false
  if (def.max !== undefined && pct > Number(def.max)) return false
  return true
})

registerCondition('hasBuff', (def, ctx) => {
  const buffs = ctx.self.comp(Buffs)
  if (!buffs) return false
  const id = String(def.id ?? '').trim()
  const tag = String(def.tag ?? '').trim()
  return buffs.matching(id, tag).length > 0
})

registerCondition('hasItem', (def, ctx) => {
  const id = String(def.id ?? '').trim()
  const tag = String(def.tag ?? '').trim()
  const equippedOnly = Boolean(def.equipped)
  const items: Item[] = []
  const equip = ctx.self.comp(Equipment)
  if (equip) {
    for (const c of equip.comps) if (c instanceof Item) items.push(c)
  }
  if (!equippedOnly) {
    const inv = ctx.self.comp(Inventory)
    if (inv) items.push(...inv.items)
  }
  return items.some((item) => {
    const idOk = !id || item.id === id
    const tagOk = !tag || ((item.params.tags as string[] | undefined) ?? []).includes(tag)
    return idOk && tagOk
  })
})

registerCondition('storyFlag', (def, ctx) => {
  const key = String(def.key ?? '').trim()
  if (!key) return false
  const val = ctx.flags?.[key] ?? ctx.payload[key]
  if (def.value !== undefined && def.value !== '') return val === def.value
  return Boolean(val)
})

const EXPLAINERS: Record<string, (def: ConditionDef) => string> = {
  level: (d) => {
    const scope = d.class ? `${String(d.class)} level` : 'Level'
    if (d.min !== undefined && d.max !== undefined) return `${scope} ${d.min}–${d.max}`
    if (d.min !== undefined) return `${scope} >= ${d.min}`
    if (d.max !== undefined) return `${scope} <= ${d.max}`
    return scope
  },
  class: (d) => {
    const id = String(d.id || '?')
    const lvl = d.minLevel ? ` (Lv ${d.minLevel}+)` : ''
    const act = d.activeOnly ? ' [active]' : ''
    return `Class ${id}${lvl}${act}`
  },
  tag: (d) => `Tag "${String(d.tag || '?')}"`,
  trait: (d) => `Trait ${String(d.id || '?')}`,
  healthPct: (d) => {
    if (d.max !== undefined && d.min !== undefined) return `HP ${d.min}%–${d.max}%`
    if (d.max !== undefined) return `HP <= ${d.max}%`
    if (d.min !== undefined) return `HP >= ${d.min}%`
    return 'HP %'
  },
  stat: (d) => {
    const parts = [String(d.stat || '?')]
    if (d.min !== undefined) parts.push(`>= ${d.min}`)
    if (d.max !== undefined) parts.push(`<= ${d.max}`)
    return parts.join(' ')
  },
  hasBuff: (d) => `Buff ${String(d.id || d.tag || '?')}`,
  hasItem: (d) => `${d.equipped ? 'Equipped' : 'Carrying'} ${String(d.id || d.tag || 'item')}`,
  storyFlag: (d) => `Story flag "${String(d.key || '?')}"${d.value !== undefined && d.value !== '' ? ` = ${String(d.value)}` : ''}`,
  is: (d) => `${String(d.field || '?')} == ${String(d.value ?? '')}`,
  chance: (d) => `${Number(d.percent ?? 0)}% chance`,
  all: (d) => {
    const list = (d.conditions as ConditionDef[] | undefined) ?? []
    return list.length ? `All of (${list.map(explainOne).join('; ')})` : 'All (empty)'
  },
  any: (d) => {
    const list = (d.conditions as ConditionDef[] | undefined) ?? []
    return list.length ? `Any of (${list.map(explainOne).join(' OR ')})` : 'Any (empty)'
  },
  not: (d) => `Not (${explainOne((d.condition as ConditionDef) ?? { type: 'all', conditions: [] })})`
}

export function explainOne(def: ConditionDef): string {
  const fn = EXPLAINERS[def.type]
  return fn ? fn(def) : def.type
}

export function explainConditions(
  defs: ConditionDef[],
  ctx: ConditionContext
): { passed: boolean; reasons: string[]; checks: Array<{ ok: boolean; label: string }> } {
  const checks = defs.map((def) => ({ ok: test(def, ctx), label: explainOne(def) }))
  const reasons = checks.filter((c) => !c.ok).map((c) => c.label)
  return { passed: reasons.length === 0, reasons, checks }
}
