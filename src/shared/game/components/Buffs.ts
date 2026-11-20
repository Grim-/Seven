import type { EffectGroup } from '../effectGroups'
import type { EffectBranch, EffectLane } from './Action'
import { Component, createComponent, registerComponent, restoreComponent, type ComponentDef, type ComponentRecord, type GameEntity, type TooltipRow } from '../core'

export class Buff extends Component {
  static readonly type: string = 'buff'
  static readonly LABEL: string = 'Buff'
  static readonly ICON: string = 'Sparkle'
  static readonly LANES: EffectLane[] = [{ event: 'OnUse', label: 'While it lasts' }]
  static readonly DESCRIPTION: string = 'A buff or debuff: lasts its duration and holds the pieces that do its work. The same buff from the same source adds stacks.'
  static readonly PARAMS = {
    id: { kind: 'text' as const, default: '', description: 'Which buff this is; with the source, decides when two applications stack.' },
    duration: { kind: 'duration' as const, default: 0, min: 0, description: 'How long it lasts. 0 lasts until removed.', section: 'Duration and stacking' },
    potency: { kind: 'number' as const, default: 1, min: 0, description: 'Strength per stack, read by its pieces.', section: 'Duration and stacking' },
    maxStacks: { kind: 'number' as const, default: 1, min: 1, description: 'Most stacks it can reach.', section: 'Duration and stacking' },
    endsOn: { kind: 'list' as const, default: [], of: { kind: 'signal' as const, default: '', description: 'A signal on the holder that ends it, such as On Long Rest.' }, description: 'Signals on the holder that end it, such as On Short Rest or On Long Rest.', section: 'Duration and stacking' },
    tags: { kind: 'list' as const, default: [], of: { kind: 'text' as const, default: '', description: 'A tag, such as debuff or curable.' }, description: 'Tags that effects can find it by, such as debuff or poison.', section: 'Tags' }
  }
  source: string | null = null
  key: string | null = null
  stacks = 1
  elapsed = 0
  remaining = Infinity

  canApply(host: Component | GameEntity): true | string {
    return host instanceof Buffs ? true : 'a buff belongs in buffs'
  }

  get id(): string {
    return String(this.params.id)
  }

  get strength(): number {
    return Number(this.params.potency) * this.stacks
  }

  get tags(): string[] {
    return Array.isArray(this.params.tags) ? this.params.tags.map(String) : []
  }

  matches(id: string, tag: string): boolean {
    return (!id || this.id === id) && (!tag || this.tags.includes(tag)) && Boolean(id || tag)
  }

  identity(): string {
    return `${this.id}/${this.key ?? this.source ?? ''}`
  }

  onApplied(): void {
    super.onApplied()
    if (this.remaining === Infinity && Number(this.params.duration) > 0) this.remaining = Number(this.params.duration)
    const entity = this.entity
    const ends = Array.isArray(this.params.endsOn) ? this.params.endsOn.map(String).filter(Boolean) : []
    if (entity) for (const signal of ends) this.bind(entity, signal, () => (this.parent instanceof Buffs ? this.parent.removeBuff(this) : undefined))
  }

  advance(seconds: number): void {
    this.elapsed += seconds
    if (this.remaining !== Infinity) this.remaining -= seconds
  }

  done(): boolean {
    const pieces = this.comps.filter((c): c is BuffPiece => c instanceof BuffPiece && c.finite)
    return this.remaining <= 1e-6 || (pieces.length > 0 && pieces.every((p) => p.isDone()))
  }

  end(): void {
    for (const c of this.comps) if (c instanceof BuffPiece) c.onEnd()
  }

  protected saveState(): Record<string, unknown> {
    return { source: this.source, key: this.key, stacks: this.stacks, elapsed: this.elapsed, remaining: this.remaining === Infinity ? null : this.remaining }
  }

  protected loadState(state: Record<string, unknown>): void {
    this.source = typeof state.source === 'string' ? state.source : null
    this.key = typeof state.key === 'string' ? state.key : null
    this.stacks = Number(state.stacks) || 1
    this.elapsed = Number(state.elapsed) || 0
    this.remaining = typeof state.remaining === 'number' ? state.remaining : Infinity
  }
}

export abstract class PassiveHost extends Component {
  abstract get strength(): number

  isActive(): boolean {
    return true
  }
}

export function isPassiveHost(value: unknown): value is PassiveHost {
  if (value instanceof PassiveHost) return true
  if (!(value instanceof Component)) return false
  const candidate = value as Partial<PassiveHost>
  return typeof candidate.strength === 'number' && typeof candidate.isActive === 'function'
}

export abstract class BuffPiece extends Component {
  static readonly SENTENCE: string = ''
  static readonly GROUP: EffectGroup | null = null
  static readonly ICON: string = 'Sparkles'
  static readonly BRANCHES: EffectBranch[] = []
  static readonly AIMS: boolean = false
  readonly finite: boolean = false

  canApply(host: Component | GameEntity): true | string {
    return host instanceof Buff || isPassiveHost(host) ? true : 'a buff piece belongs inside a buff or trait'
  }

  get buff(): Buff | null {
    return this.parent instanceof Buff ? this.parent : null
  }

  get passiveHost(): Buff | PassiveHost | null {
    if (this.parent instanceof Buff || isPassiveHost(this.parent)) return this.parent
    return null
  }

  get isHostActive(): boolean {
    return isPassiveHost(this.parent) ? this.parent.isActive() : true
  }

  get strength(): number {
    if (!this.isHostActive) return 0
    return this.passiveHost?.strength ?? 1
  }

  isDone(): boolean {
    return false
  }

  onEnd(): void {}
}

export class Buffs extends Component {
  static readonly type: string = 'buffs'
  static readonly LABEL: string = 'Buffs'
  static readonly ICON: string = 'Sparkles'
  static readonly DESCRIPTION: string = 'The buffs and debuffs on an entity. Ticks them, stacks repeats, and removes them when they end.'
  static readonly PARAMS = {}

  canApply(host: Component | GameEntity): true | string {
    return 'catalog' in host ? true : 'buffs belong on an entity'
  }

  get held(): Buff[] {
    return this.comps.filter((c): c is Buff => c instanceof Buff)
  }

  apply(def: ComponentDef, source: GameEntity | null, key: string | null = null): Buff | null {
    const made = createComponent({ ...def, type: 'buff' })
    if (!(made instanceof Buff)) return null
    made.source = source?.uid ?? null
    made.key = key
    const same = this.held.find((b) => b.identity() === made.identity())
    if (same) {
      same.stacks = Math.min(Number(same.params.maxStacks), same.stacks + 1)
      if (Number(same.params.duration) > 0) same.remaining = Number(same.params.duration)
      this.entity?.emit('OnBuffStacked', { buff: same.id, stacks: same.stacks })
      return same
    }
    if (!this.add(made)) return null
    this.entity?.emit('OnBuffApplied', { buff: made.id, source: made.source })
    return made
  }

  matching(id: string, tag: string): Buff[] {
    return this.held.filter((b) => b.matches(id, tag))
  }

  take(buff: Buff): ComponentRecord | null {
    const record = buff.toJSON()
    if (!this.remove(buff)) return null
    this.entity?.emit('OnBuffRemoved', { buff: buff.id })
    return record
  }

  receive(record: ComponentRecord): Buff | null {
    const made = restoreComponent(record)
    if (!(made instanceof Buff)) return null
    const same = this.held.find((b) => b.identity() === made.identity())
    if (same) {
      same.stacks = Math.min(Number(same.params.maxStacks), same.stacks + made.stacks)
      same.remaining = Math.max(same.remaining, made.remaining)
      this.entity?.emit('OnBuffStacked', { buff: same.id, stacks: same.stacks })
      return same
    }
    if (!this.add(made)) return null
    this.entity?.emit('OnBuffApplied', { buff: made.id, source: made.source })
    return made
  }

  dropExpired(seconds: number): void {
    for (const b of this.held) if (b.remaining <= seconds) this.remove(b)
  }

  removeBuff(buff: Buff): void {
    buff.end()
    if (this.remove(buff)) this.entity?.emit('OnBuffRemoved', { buff: buff.id })
  }

  tickSim(seconds: number): void {
    for (const b of this.held) {
      const span = Math.min(seconds, b.remaining)
      b.tickSim(span)
      b.advance(span)
      if (b.done()) this.removeBuff(b)
    }
  }

  tooltipRows(): TooltipRow[] {
    return this.held.map((b) => ({ label: b.stacks > 1 ? `${b.id} ×${b.stacks}` : b.id, value: b.remaining === Infinity ? 'until removed' : `${Math.ceil(b.remaining)} s` }))
  }
}

registerComponent(Buff)
registerComponent(Buffs)
