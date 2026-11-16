import { Component, createComponent, registerComponent, roll, test, type ComponentDef, type ConditionDef, type GameEntity, type TooltipRow } from '../core'
import { Action, MAX_CHAIN_DEPTH, type EffectLane } from './Action'
import type { PassiveHost } from './Buffs'
import type { Hit } from './Health'
import { Stats } from './Stats'

interface ClassActiveLookup {
  isClassActive(id: string): boolean
}

function isOwnerClassActive(entity: GameEntity | null, sourceClass: string, permanent: boolean): boolean {
  if (!sourceClass || permanent || !entity) return true
  const classes = entity.comps.find((c) => c.type === 'classes') as (Component & Partial<ClassActiveLookup>) | undefined
  if (!classes || typeof classes.isClassActive !== 'function') return false
  return classes.isClassActive(sourceClass)
}

const TARGET_PICKERS: Record<string, (self: GameEntity, source: GameEntity | null, triggerTarget: GameEntity | null) => GameEntity | null> = {
  self: (self) => self,
  source: (self, source) => source ?? self,
  triggerTarget: (self, _source, triggerTarget) => triggerTarget ?? self
}

export class Trait extends Action implements PassiveHost {
  static readonly type: string = 'trait'
  static readonly LABEL: string = 'Trait'
  static readonly ICON: string = 'Sparkles'
  static readonly DESCRIPTION: string = 'Innate passive effect or signal-reactive ability on an entity or class.'
  static readonly PARAMS = {
    id: { kind: 'text' as const, default: '', description: 'Identifier of this trait.' },
    label: { kind: 'text' as const, default: '', description: 'Display name shown on sheets.' },
    description: { kind: 'text' as const, default: '', description: 'Short summary of what this trait does.' },
    signal: { kind: 'signal' as const, default: '', description: 'Optional signal on the entity that fires this trait (e.g. OnMove, OnHit, OnBeforeDeath, OnSpawn).' },
    when: { kind: 'conditions' as const, default: [], description: 'Signal conditions that must hold when the signal fires.', section: 'Conditions' },
    activeWhen: { kind: 'conditions' as const, default: [], description: 'Ongoing conditions for this trait and its passive pieces to stay active.', section: 'Conditions' },
    target: { kind: 'choice' as const, default: 'self', choices: ['self', 'source', 'triggerTarget'], description: 'Target passed into triggered pieces.' },
    chance: { kind: 'number' as const, default: 100, min: 0, max: 100, description: 'Percent chance (0–100) to trigger when the signal arrives.' },
    cooldown: { kind: 'number' as const, default: 0, min: 0, description: 'Cooldown in seconds after triggering.' },
    maxUses: { kind: 'number' as const, default: 0, min: 0, description: 'Maximum times this trait can trigger (0 = unlimited).' },
    consume: { kind: 'choice' as const, default: 'none', choices: ['none', 'cooldown', 'exhaust', 'remove'], description: 'What happens when the trait triggers (or reaches max uses).' },
    potency: { kind: 'number' as const, default: 1, description: 'Strength passed to passive buff pieces inside this trait.' },
    tags: { kind: 'list' as const, default: [], description: 'Keyword tags granted while this trait is active.' },
    sourceClass: { kind: 'template' as const, templateKind: 'game_class', default: '', description: 'Class id that granted this trait, if any.' },
    permanent: { kind: 'flag' as const, default: false, description: 'Keep this trait even if its granting class is lost.' }
  }
  static readonly LANES: EffectLane[] = [{ event: 'OnUse', label: 'When triggered' }]

  cooldownLeft = 0
  exhausted = false
  key: string | null = null

  get strength(): number {
    return this.isActive() ? Number(this.params.potency ?? 1) : 0
  }

  get title(): string {
    return String(this.params.label || this.id)
  }

  get sourceClass(): string {
    return String(this.params.sourceClass || '')
  }

  get isPermanent(): boolean {
    return Boolean(this.params.permanent)
  }

  canApply(host: Component | GameEntity): true | string {
    return host instanceof Traits || 'catalog' in host ? true : 'a trait belongs in Traits or on an entity'
  }

  isActive(): boolean {
    if (this.exhausted || this.cooldownLeft > 0) return false
    const self = this.entity
    if (!self) return true
    if (!isOwnerClassActive(self, this.sourceClass, this.isPermanent)) return false
    const activeWhen = (this.params.activeWhen as ConditionDef[]) ?? []
    if (!activeWhen.length) return true
    const ctx = {
      self,
      payload: {},
      seed: `${self.uid}:${this.id}`,
      stat: (who: GameEntity, statId: string) => who.comp(Stats)?.value(statId) ?? 0
    }
    return activeWhen.every((cond) => test(cond, ctx))
  }

  grantedTags(): string[] {
    if (!this.isActive()) return []
    return ((this.params.tags as string[]) ?? []).map((t) => String(t).trim()).filter(Boolean)
  }

  override modifyStat(domain: string, key: string, value: number): number {
    if (!this.isActive()) return value
    return super.modifyStat(domain, key, value)
  }

  override modifyStatLate(domain: string, key: string, value: number): number {
    if (!this.isActive()) return value
    return super.modifyStatLate(domain, key, value)
  }

  override modifyIncomingDamage(amount: number, hit: Hit): number {
    if (!this.isActive()) return amount
    return super.modifyIncomingDamage(amount, hit)
  }

  override isInvisible(): boolean {
    if (!this.isActive()) return false
    return super.isInvisible()
  }

  onApplied(): void {
    super.onApplied()
    const self = this.entity
    const signal = String(this.params.signal ?? '').trim()
    if (!self || !signal) return
    this.bind(self, signal, (payload) => this.handleSignal(payload))
  }

  private handleSignal(payload: Record<string, unknown>): void {
    const self = this.entity
    if (!self || !this.isActive()) return
    const chainDepth = typeof payload.chainDepth === 'number' ? payload.chainDepth : 0
    if (chainDepth >= MAX_CHAIN_DEPTH) return

    const maxUses = Number(this.params.maxUses ?? 0)
    if (maxUses > 0 && this.uses >= maxUses) return

    const when = (this.params.when as ConditionDef[]) ?? []
    const condCtx = {
      self,
      payload,
      seed: `${self.uid}:${this.id}:${this.uses}`,
      stat: (who: GameEntity, statId: string) => who.comp(Stats)?.value(statId) ?? 0
    }
    if (!when.every((cond) => test(cond, condCtx))) return

    const chance = Number(this.params.chance ?? 100)
    if (chance < 100) {
      if (chance <= 0) return
      const outcome = roll(`${self.uid}:${this.id}:chance`, this.uses) * 100
      if (outcome >= chance) return
    }

    const source = typeof payload.source === 'string' ? (self.world?.find(payload.source) ?? null) : null
    const triggerTarget = typeof payload.target === 'string' ? (self.world?.find(payload.target) ?? null) : null
    const picker = TARGET_PICKERS[String(this.params.target || 'self')] ?? TARGET_PICKERS.self
    const target = picker(self, source, triggerTarget)

    // Consume cooldown/exhaustion before firing so recursive signals cannot re-enter this trait.
    const nextUses = this.uses + 1
    const consume = String(this.params.consume || 'none')
    const cooldown = Number(this.params.cooldown ?? 0)
    if (cooldown > 0 && (consume === 'cooldown' || consume === 'none')) this.cooldownLeft = cooldown
    if (consume === 'exhaust' || (maxUses > 0 && nextUses >= maxUses && consume === 'none')) this.exhausted = true

    this.fire('OnUse', { user: self, target, at: null, distance: 0, chainDepth }, payload)

    if (consume === 'remove' || (maxUses > 0 && nextUses >= maxUses && consume === 'remove')) {
      this.removeSelfFromOwner('consumed')
    }
  }

  removeSelfFromOwner(reason = 'removed'): void {
    const self = this.entity
    const parent = this.parent
    if (!parent) return
    if (parent instanceof Traits) parent.removeTrait(this, reason)
    else if (parent.remove(this)) self?.emit('OnTraitLost', { trait: this.id, reason })
  }

  resetUsage(): void {
    this.cooldownLeft = 0
    this.exhausted = false
    this.uses = 0
  }

  tickSim(seconds: number): void {
    super.tickSim(seconds)
    if (this.cooldownLeft > 0) this.cooldownLeft = Math.max(0, this.cooldownLeft - seconds)
  }

  override saveState(): Record<string, unknown> {
    const out: Record<string, unknown> = { ...super.saveState() }
    if (this.cooldownLeft > 0) out.cooldownLeft = this.cooldownLeft
    if (this.exhausted) out.exhausted = true
    if (this.key) out.key = this.key
    return out
  }

  override loadState(state: Record<string, unknown>): void {
    super.loadState(state)
    if (typeof state.cooldownLeft === 'number') this.cooldownLeft = state.cooldownLeft
    if (typeof state.exhausted === 'boolean') this.exhausted = state.exhausted
    if (typeof state.key === 'string') this.key = state.key
  }

  tooltipRows(): TooltipRow[] {
    const rows: TooltipRow[] = []
    if (!this.isActive()) {
      rows.push({ label: 'State', value: this.exhausted ? 'exhausted' : this.cooldownLeft > 0 ? `cooldown (${Math.ceil(this.cooldownLeft)}s)` : 'inactive' })
    } else if (String(this.params.signal || '')) {
      rows.push({ label: 'Trigger', value: String(this.params.signal) })
    }
    return rows
  }
}

export class Traits extends Component {
  static readonly type: string = 'traits'
  static readonly LABEL: string = 'Traits'
  static readonly ICON: string = 'Sparkles'
  static readonly DESCRIPTION: string = 'Innate passive traits on an entity or character.'
  static readonly PARAMS = {}

  canApply(host: Component | GameEntity): true | string {
    return 'catalog' in host ? true : 'traits belong on an entity'
  }

  get held(): Trait[] {
    return this.comps.filter((c): c is Trait => c instanceof Trait)
  }

  has(id: string): boolean {
    return this.held.some((t) => t.id === id)
  }

  hasActive(id: string): boolean {
    return this.held.some((t) => t.id === id && t.isActive())
  }

  byId(id: string): Trait | null {
    return this.held.find((t) => t.id === id) ?? null
  }

  grant(def: ComponentDef, opts: { sourceClass?: string; permanent?: boolean; key?: string } = {}): Trait | null {
    const traitId = String(def.id ?? '')
    const existing = traitId ? this.byId(traitId) : null
    if (existing) {
      if (opts.permanent) existing.params.permanent = true
      return existing
    }
    const made = createComponent({
      ...def,
      type: Trait.type,
      ...(opts.sourceClass ? { sourceClass: opts.sourceClass } : {}),
      ...(opts.permanent !== undefined ? { permanent: opts.permanent } : {})
    })
    if (!(made instanceof Trait)) return null
    made.key = opts.key ?? (opts.sourceClass ? `class:${opts.sourceClass}` : null)
    if (!this.add(made)) return null
    this.entity?.emit('OnTraitGained', { trait: made.id, label: made.title, sourceClass: opts.sourceClass ?? '' })
    return made
  }

  removeTrait(trait: Trait, reason = 'removed'): boolean {
    if (!this.remove(trait)) return false
    this.entity?.emit('OnTraitLost', { trait: trait.id, label: trait.title, reason })
    return true
  }

  removeById(id: string, reason = 'removed'): boolean {
    const found = this.byId(id)
    return found ? this.removeTrait(found, reason) : false
  }

  stripClassTraits(classId: string): number {
    let removed = 0
    for (const trait of [...this.held]) {
      if (trait.sourceClass === classId && !trait.isPermanent) {
        if (this.removeTrait(trait, `class:${classId}`)) removed += 1
      }
    }
    return removed
  }

  tooltipRows(): TooltipRow[] {
    return this.held.map((t) => ({
      label: t.title,
      value: t.isActive() ? (t.sourceClass ? `class: ${t.sourceClass}` : 'active') : 'inactive'
    }))
  }
}

registerComponent(Trait)
registerComponent(Traits)
