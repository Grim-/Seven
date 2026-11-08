import { Component, registerComponent, type GameEntity, type TooltipRow } from '../core'
import { Stats } from './Stats'

export class Resource extends Component {
  static readonly type: string = 'resource'
  static readonly DESCRIPTION: string = 'A value that fills and drains, such as Stamina or Mana. Its maximum and regeneration come from its stat.'
  static readonly PARAMS = { stat: { kind: 'template' as const, templateKind: 'stat', default: '', description: 'The stat that gives this resource its maximum and regeneration.' } }
  protected current = Number.NaN

  static of(entity: GameEntity, stat: string): Resource | null {
    for (const c of entity.comps) if (c instanceof Resource && c.stat === stat) return c
    return null
  }

  canApply(host: Component | GameEntity): true | string {
    return 'catalog' in host ? true : 'a resource belongs on an entity'
  }

  get stat(): string {
    return String(this.params.stat)
  }

  private stats(): Stats | null {
    return this.entity?.comp(Stats) ?? null
  }

  max(): number {
    return this.stats()?.value(this.stat) ?? 0
  }

  get(): number {
    return Math.max(0, Math.min(this.max(), Number.isNaN(this.current) ? this.max() : this.current))
  }

  set(value: number): number {
    const before = this.get()
    this.current = Math.max(0, Math.min(this.max(), value))
    return this.current - before
  }

  change(amount: number): number {
    return this.set(this.get() + amount)
  }

  spend(amount: number): boolean {
    if (this.get() < amount) return false
    this.set(this.get() - amount)
    return true
  }

  tickSim(seconds: number): void {
    super.tickSim(seconds)
    const def = this.entity?.catalog.stat(this.stat)
    if (!def?.regenPerSecond) return
    const scale = def.regenScaledBy ? (this.stats()?.value(def.regenScaledBy) ?? 1) : 1
    this.change(def.regenPerSecond * scale * seconds)
  }

  protected saveState(): Record<string, unknown> {
    return { current: this.get() }
  }

  protected loadState(state: Record<string, unknown>): void {
    if (typeof state.current === 'number') this.current = state.current
  }

  tooltipRows(): TooltipRow[] {
    const label = this.entity?.catalog.stat(this.stat)?.label ?? this.stat
    return [{ label, value: `${Math.round(this.get())}/${Math.round(this.max())}` }]
  }
}

registerComponent(Resource)
