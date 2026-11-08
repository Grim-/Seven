import type { GameEntity } from '../core'
import { Resource } from './Resource'

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
