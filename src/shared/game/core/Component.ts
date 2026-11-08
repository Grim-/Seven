import { resolveParams, type ParamSchema } from './params'
import { SignalBus, type SignalHandler } from './signals'
import type { GameEntity } from './GameEntity'

export interface ComponentRecord {
  uid: string
  type: string
  params: Record<string, unknown>
  state: Record<string, unknown>
  comps: ComponentRecord[]
}

export interface SignalSource {
  readonly signals: SignalBus
}

export interface SheetNode {
  kind: string
  [field: string]: unknown
}

export interface TooltipRow {
  label: string
  value: string
}

const EPSILON = 1e-6

export abstract class Component implements SignalSource {
  static readonly type: string = ''
  static readonly DESCRIPTION: string = ''
  static readonly PARAMS: ParamSchema = {}

  readonly uid: string
  readonly params: Record<string, unknown>
  parent: Component | null = null
  host: GameEntity | null = null
  comps: Component[] = []
  private own: SignalBus | null = null
  private bindings: (() => void)[] = []
  private intervals: Record<string, number> = {}
  private attached = false

  constructor(params: Record<string, unknown>, uid: string = crypto.randomUUID()) {
    this.uid = uid
    this.params = resolveParams((this.constructor as typeof Component).PARAMS, params)
  }

  get type(): string {
    return (this.constructor as typeof Component).type
  }

  get entity(): GameEntity | null {
    return this.host ?? this.parent?.entity ?? null
  }

  get signals(): SignalBus {
    this.own ??= new SignalBus()
    return this.own
  }

  canApply(_host: Component | GameEntity): true | string {
    return true
  }

  comp<T extends Component>(Type: abstract new (...args: never[]) => T): T | null {
    for (const c of this.comps) if (c instanceof Type) return c
    return null
  }

  add(comp: Component): boolean {
    if (comp.canApply(this) !== true) return false
    comp.parent = this
    this.comps.push(comp)
    if (this.attached) comp.attach()
    return true
  }

  remove(comp: Component): boolean {
    const i = this.comps.indexOf(comp)
    if (i < 0) return false
    this.comps.splice(i, 1)
    comp.detach()
    comp.parent = null
    return true
  }

  attach(): void {
    if (this.attached) return
    this.attached = true
    this.unbind()
    this.onApplied()
    for (const c of this.comps) c.attach()
  }

  detach(): void {
    for (const c of this.comps) c.detach()
    if (!this.attached) return
    this.attached = false
    this.onRemoved()
  }

  onApplied(): void {}

  onRemoved(): void {
    this.unbind()
  }

  bind(source: SignalSource, signal: string, fn: SignalHandler): void {
    this.bindings.push(source.signals.on(signal, fn))
  }

  unbind(): void {
    for (const off of this.bindings) off()
    this.bindings = []
  }

  emit(signal: string, payload: Record<string, unknown> = {}): void {
    this.signals.emit(signal, payload)
  }

  tickSim(seconds: number): void {
    for (const c of [...this.comps]) c.tickSim(seconds)
  }

  repeatEvery(key: string, interval: number, seconds: number, fn: () => void): void {
    if (interval <= 0) return fn()
    let elapsed = (this.intervals[key] ?? 0) + seconds
    while (elapsed >= interval - EPSILON) {
      elapsed -= interval
      fn()
    }
    this.intervals[key] = elapsed
  }

  modifyStat(domain: string, key: string, value: number): number {
    let out = value
    for (const c of this.comps) out = c.modifyStat(domain, key, out)
    return out
  }

  modifyStatLate(domain: string, key: string, value: number): number {
    let out = value
    for (const c of this.comps) out = c.modifyStatLate(domain, key, out)
    return out
  }

  protected saveState(): Record<string, unknown> {
    return {}
  }

  protected loadState(_state: Record<string, unknown>): void {}

  toJSON(): ComponentRecord {
    return { uid: this.uid, type: this.type, params: { ...this.params }, state: { ...this.saveState(), intervals: { ...this.intervals } }, comps: this.comps.map((c) => c.toJSON()) }
  }

  fromJSON(record: ComponentRecord): void {
    const intervals = record.state.intervals
    this.intervals = intervals && typeof intervals === 'object' ? { ...(intervals as Record<string, number>) } : {}
    this.loadState(record.state)
  }

  sheet(): SheetNode[] {
    return []
  }

  tooltipRows(): TooltipRow[] {
    return []
  }
}
