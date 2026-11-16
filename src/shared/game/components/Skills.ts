import { Component, registerComponent, type GameEntity, type TooltipRow } from '../core'

export class Skills extends Component {
  static readonly type: string = 'skills'
  static readonly LABEL: string = 'Skills'
  static readonly ICON: string = 'Compass'
  static readonly DESCRIPTION: string = 'Skill ranks and proficiencies added to checks on this character.'
  static readonly PARAMS = {
    ranks: {
      kind: 'values' as const,
      templateKind: 'check',
      default: {},
      description: 'Base rank bonus per check or skill id.'
    }
  }

  canApply(host: Component | GameEntity): true | string {
    return 'catalog' in host ? true : 'skills belong on an entity'
  }

  ranks(): Record<string, number> {
    const raw = (this.params.ranks ?? {}) as Record<string, unknown>
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(raw)) {
      const n = Number(v)
      if (Number.isFinite(n) && n !== 0) out[k] = n
    }
    return out
  }

  rank(id: string): number {
    const raw = (this.params.ranks ?? {}) as Record<string, unknown>
    const n = Number(raw[id] ?? 0)
    return Number.isFinite(n) ? n : 0
  }

  setRank(id: string, value: number): void {
    const key = id.trim()
    if (!key) return
    const next = { ...((this.params.ranks ?? {}) as Record<string, number>) }
    const clean = Number.isFinite(value) ? value : 0
    if (clean === 0) delete next[key]
    else next[key] = clean
    this.params.ranks = next
  }

  addRank(id: string, delta: number): number {
    const next = this.rank(id) + (Number.isFinite(delta) ? delta : 0)
    this.setRank(id, next)
    return next
  }

  modifyStat(domain: string, key: string, value: number): number {
    if (domain !== 'check') return value
    return value + this.rank(key)
  }

  tooltipRows(): TooltipRow[] {
    const entries = Object.entries(this.ranks())
    if (!entries.length) return []
    return entries.map(([k, v]) => ({
      label: this.entity?.catalog.check(k)?.label ?? k,
      value: v >= 0 ? `+${v}` : String(v)
    }))
  }
}

registerComponent(Skills)
