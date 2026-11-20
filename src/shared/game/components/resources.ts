import { GameEntity, type Catalog, type EntityRecord } from '../core'
import { Health } from './Health'
import { Resource } from './Resource'
import { Stats } from './Stats'

export interface ResourceView {
  stat: string
  label: string
  current: number
  max: number
  colour: string | null
}

export function resourcesOf(entity: GameEntity): ResourceView[] {
  return entity.comps
    .filter((c): c is Resource => c instanceof Resource)
    .map((r) => {
      const def = entity.catalog.stat(r.stat)
      return { stat: r.stat, label: def?.label ?? r.stat, current: r.get(), max: r.max(), colour: def?.colour ?? null }
    })
}

/** Reads live Health (`cur`, `max`, `dead`) from a Game-tab `EntityRecord` when present. */
export function recordHealth(
  record: EntityRecord | null | undefined,
  catalog: Catalog | null | undefined
): { cur: number; max: number; dead: boolean } | null {
  if (!record || !catalog) return null
  const hp = GameEntity.fromRecord(record, catalog).comp(Health)
  if (!hp) return null
  return {
    cur: hp.isDead ? 0 : Math.max(0, Math.round(hp.get())),
    max: Math.max(0, Math.round(hp.max())),
    dead: hp.isDead
  }
}

/** Reads a computed Stat value from a Game-tab `EntityRecord` when present. */
export function recordStat(
  record: EntityRecord | null | undefined,
  catalog: Catalog | null | undefined,
  statId: string
): number | null {
  if (!record || !catalog || !statId) return null
  const stats = GameEntity.fromRecord(record, catalog).comp(Stats)
  return stats ? stats.value(statId) : null
}
