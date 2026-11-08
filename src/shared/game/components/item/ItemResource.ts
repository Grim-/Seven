import { Component, registerComponent, type GameEntity, type TooltipRow } from '../../core'
import { Item } from '../Inventory'

export class ItemResource extends Component {
  static readonly type: string = 'item.resource'
  static readonly DESCRIPTION: string = 'A value kept on this one item, such as charges, a magazine or durability. Abilities inside the item can spend it (Item cost) and Refill fills it.'
  static readonly PARAMS = {
    id: { kind: 'text' as const, default: 'charges', description: 'Its id, used by Item cost and Refill.' },
    label: { kind: 'text' as const, default: 'Charges', description: 'Its name.' },
    max: { kind: 'number' as const, default: 10, min: 0, description: 'Most it can hold.' },
    startFull: { kind: 'flag' as const, default: true, description: 'A new item starts full. Off starts it empty.' },
    regenPerSecond: { kind: 'number' as const, default: 0, description: 'Change every game second. Negative drains it.' },
    colour: { kind: 'text' as const, default: '', description: 'Bar colour: a theme colour name such as accent, cyan, purple, ok or alert.' }
  }
  protected current = Number.NaN

  static of(item: Component, id: string): ItemResource | null {
    for (const c of item.comps) if (c instanceof ItemResource && c.id === id) return c
    return null
  }

  canApply(host: Component | GameEntity): true | string {
    return host instanceof Item ? true : 'this piece belongs inside an item'
  }

  get id(): string {
    return String(this.params.id)
  }

  max(): number {
    return Number(this.params.max)
  }

  get(): number {
    if (Number.isNaN(this.current)) return this.params.startFull ? this.max() : 0
    return Math.max(0, Math.min(this.max(), this.current))
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
    const rate = Number(this.params.regenPerSecond)
    if (rate) this.change(rate * seconds)
  }

  protected saveState(): Record<string, unknown> {
    return { current: this.get() }
  }

  protected loadState(state: Record<string, unknown>): void {
    if (typeof state.current === 'number') this.current = state.current
  }

  tooltipRows(): TooltipRow[] {
    return [{ label: String(this.params.label || this.id), value: `${Math.round(this.get())}/${Math.round(this.max())}` }]
  }
}

registerComponent(ItemResource)
