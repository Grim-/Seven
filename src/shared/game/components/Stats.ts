import { Component, registerComponent, type GameEntity, type TooltipRow } from '../core'

export class Stats extends Component {
  static readonly type: string = 'stats'
  static readonly LABEL: string = 'Stats'
  static readonly ICON: string = 'BarChart3'
  static readonly DESCRIPTION: string = 'Base stat and resist values. Every read adds what equipment, buffs and other components change.'
  static readonly PARAMS = { base: { kind: 'values' as const, templateKind: 'stat', default: {}, description: 'Base value per stat or resist id. Missing ones use the stat default.' } }
  private base: Record<string, number> = { ...(this.params.base as Record<string, number>) }

  canApply(host: Component | GameEntity): true | string {
    return 'catalog' in host ? true : 'stats belong on an entity'
  }

  value(id: string): number {
    const entity = this.entity
    const def = entity?.catalog.stat(id)
    if (!entity || !def) return this.base[id] ?? 0
    const start = this.base[id] ?? def.default
    const value = entity.modifyStatLate(def.domain, id, entity.modifyStat(def.domain, id, start))
    return Math.min(def.max, Math.max(def.min, value))
  }

  baseValue(id: string): number {
    return this.base[id] ?? this.entity?.catalog.stat(id)?.default ?? 0
  }

  setBase(id: string, value: number): void {
    this.base[id] = value
  }

  protected saveState(): Record<string, unknown> {
    return { base: { ...this.base } }
  }

  protected loadState(state: Record<string, unknown>): void {
    if (state.base && typeof state.base === 'object') this.base = { ...(state.base as Record<string, number>) }
  }

  tooltipRows(): TooltipRow[] {
    const catalog = this.entity?.catalog
    if (!catalog) return []
    return catalog.stats().map((def) => ({ label: def.label, value: String(Math.round(this.value(def.id) * 100) / 100) }))
  }
}

registerComponent(Stats)
