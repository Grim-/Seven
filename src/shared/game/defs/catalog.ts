import type { Catalog } from '../core/catalog'
import type { CatalogData } from './defs'

export function catalogFrom(data: CatalogData): Catalog {
  const stats = new Map(data.stats.map((s) => [s.id, s]))
  const damage = new Map(data.damageTypes.map((d) => [d.id, d]))
  const times = new Map(data.times.map((t) => [t.id, t]))
  const checks = new Map(data.checks.map((c) => [c.id, c]))
  const slots = new Map(data.slots.map((s) => [s.id, s]))
  return {
    stat: (id) => stats.get(id) ?? null,
    stats: (domain) => (domain === undefined ? data.stats : data.stats.filter((s) => s.domain === domain)),
    damageType: (id) => damage.get(id) ?? null,
    formula: (id) => data.formulas[id] ?? null,
    time: (id) => times.get(id) ?? null,
    times: () => data.times,
    check: (id) => checks.get(id) ?? null,
    checks: (group) => (group === undefined ? [...checks.values()] : [...checks.values()].filter((c) => c.group === group)),
    slot: (id) => slots.get(id) ?? null,
    slots: () => data.slots,
    template: (kind, id) => data.templates[kind]?.[id] ?? null,
    entity: (kind, id) => data.entities[kind]?.[id] ?? null
  }
}
