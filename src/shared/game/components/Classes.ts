import { Component, createComponent, registerComponent, roll, test, type ComponentDef, type ConditionDef, type GameEntity, type TooltipRow } from '../core'
import { CLASS_TEMPLATES, TRAIT_TEMPLATES } from '../templateKinds'
import { ABILITY_TEMPLATES } from '../templateKinds'
import { parseClassTemplateDef, type ClassReward, type ClassTemplateDef } from '../defs/classes'
import { explainConditions, makeConditionContext } from '../rules/conditions'
import { Abilities, Ability } from './Abilities'
import { xpForNextLevel } from './Progression'
import { Skills } from './Skills'
import { Stats } from './Stats'
import { Traits } from './Traits'

export interface PendingClassUnlock {
  classId: string
  label: string
  signal: string
  prompt: string
  triggeredAt: number
}

const CLUTCH_SIGNALS = ['OnHurt', 'OnBeforeDeath', 'OnStoryMoment', 'OnLevelUp', 'OnHit'] as const

function classDefsOf(entity: GameEntity | null | undefined): ClassTemplateDef[] {
  const all = entity?.catalog.templates?.(CLASS_TEMPLATES) ?? {}
  return Object.entries(all).map(([id, raw]) => parseClassTemplateDef({ ...(raw as Record<string, unknown>), id }))
}

export function classDefOf(entity: GameEntity | null | undefined, classId: string): ClassTemplateDef | null {
  const raw = entity?.catalog.template(CLASS_TEMPLATES, classId)
  if (!raw) return null
  return parseClassTemplateDef({ ...(raw as Record<string, unknown>), id: classId })
}

export class CharacterClass extends Component {
  static readonly type: string = 'character_class'
  static readonly LABEL: string = 'Class'
  static readonly ICON: string = 'Award'
  static readonly DESCRIPTION: string = 'An individual class or specialization held by a character, with independent XP and level.'
  static readonly PARAMS = {
    id: { kind: 'template' as const, templateKind: CLASS_TEMPLATES, default: '', description: 'Class template id.' },
    level: { kind: 'number' as const, default: 1, min: 1, description: 'Current level in this class.' },
    xp: { kind: 'number' as const, default: 0, min: 0, description: 'XP earned toward the next level in this class.' }
  }

  grantedLevels: number[] = []
  statBonuses: Record<string, number> = {}
  skillBonuses: Record<string, number> = {}
  scopedTags: string[] = []
  private lastActive: boolean | null = null

  canApply(host: Component | GameEntity): true | string {
    return host instanceof Classes ? true : 'a character class belongs in Classes'
  }

  get id(): string {
    return String(this.params.id || '')
  }

  get level(): number {
    return Math.max(1, Math.floor(Number(this.params.level ?? 1)))
  }

  set level(v: number) {
    this.params.level = Math.max(1, Math.floor(v))
  }

  get xp(): number {
    return Math.max(0, Math.floor(Number(this.params.xp ?? 0)))
  }

  set xp(v: number) {
    this.params.xp = Math.max(0, Math.floor(v))
  }

  def(): ClassTemplateDef | null {
    return classDefOf(this.entity, this.id)
  }

  get title(): string {
    return this.def()?.label ?? this.id
  }

  get curve(): string {
    return this.def()?.curve || 'standard'
  }

  xpNeeded(): number {
    return xpForNextLevel(this.level, this.curve)
  }

  restrictionReasons(flags?: Record<string, unknown>): string[] {
    const self = this.entity
    const def = this.def()
    if (!self || !def) return []
    const checks: ConditionDef[] = [...def.activeWhen]
    if (def.parentClass && !checks.some((c) => c.type === 'class' && c.id === def.parentClass)) {
      checks.unshift({ type: 'class', id: def.parentClass, activeOnly: true })
    }
    if (!checks.length) return []
    return explainConditions(checks, makeConditionContext(self, { flags })).reasons
  }

  isActive(flags?: Record<string, unknown>): boolean {
    return this.restrictionReasons(flags).length === 0
  }

  checkRestrictionChange(flags?: Record<string, unknown>): boolean {
    const active = this.isActive(flags)
    if (this.lastActive !== null && this.lastActive !== active) {
      this.entity?.emit('OnClassRestricted', {
        classId: this.id,
        label: this.title,
        restricted: !active,
        reasons: active ? [] : this.restrictionReasons(flags)
      })
    }
    this.lastActive = active
    return active
  }

  grantedTags(): string[] {
    if (!this.isActive()) return []
    const base = this.def()?.tags ?? []
    return [...new Set([...base, ...this.scopedTags])]
  }

  override modifyStat(domain: string, key: string, value: number): number {
    if (!this.isActive()) return value
    if (domain === 'stat') return value + (this.statBonuses[key] ?? 0)
    if (domain === 'check') return value + (this.skillBonuses[key] ?? 0)
    return value
  }

  grantXp(amount: number, reason = ''): { gained: number; levelsGained: number; level: number; xp: number } {
    const clean = Math.floor(amount)
    if (!Number.isFinite(clean) || clean <= 0) {
      return { gained: 0, levelsGained: 0, level: this.level, xp: this.xp }
    }
    const prev = this.level
    let currentXp = this.xp + clean
    let level = prev
    while (currentXp >= xpForNextLevel(level, this.curve)) {
      currentXp -= xpForNextLevel(level, this.curve)
      level += 1
    }
    this.xp = currentXp
    this.level = level
    const applied = this.syncMilestones()
    const levelsGained = level - prev
    if (levelsGained > 0 || applied.length > 0) {
      this.entity?.emit('OnLevelUp', {
        classId: this.id,
        label: this.title,
        level: this.level,
        previous: prev,
        levelsGained,
        reason,
        rewards: applied.map((r) => r.summary || `Lv ${r.level}`)
      })
    }
    return { gained: clean, levelsGained, level: this.level, xp: this.xp }
  }

  setLevel(nextLevel: number): void {
    const prev = this.level
    this.level = Math.max(1, Math.floor(nextLevel))
    this.syncMilestones()
    if (this.level > prev) {
      this.entity?.emit('OnLevelUp', { classId: this.id, label: this.title, level: this.level, previous: prev, reason: 'manual' })
    }
  }

  syncMilestones(): ClassReward[] {
    const self = this.entity
    const def = this.def()
    if (!self || !def) return []
    const newlyApplied: ClassReward[] = []
    for (const reward of def.rewards) {
      const lv = Math.max(1, Math.floor(Number(reward.level ?? 1)))
      if (lv > this.level || this.grantedLevels.includes(lv)) continue
      this.grantedLevels.push(lv)
      this.applyReward(self, reward)
      newlyApplied.push(reward)
    }
    return newlyApplied
  }

  private applyReward(self: GameEntity, reward: ClassReward): void {
    const permanent = Boolean(reward.permanent)
    if (reward.stats) {
      const stats = self.comp(Stats)
      for (const [stat, rawDelta] of Object.entries(reward.stats)) {
        const delta = Number(rawDelta)
        if (!Number.isFinite(delta) || delta === 0) continue
        if (permanent && stats) stats.setBase(stat, stats.baseValue(stat) + delta)
        else this.statBonuses[stat] = (this.statBonuses[stat] ?? 0) + delta
      }
    }
    if (reward.skills) {
      const skills = self.comp(Skills)
      for (const [skill, rawDelta] of Object.entries(reward.skills)) {
        const delta = Number(rawDelta)
        if (!Number.isFinite(delta) || delta === 0) continue
        if (permanent && skills) skills.addRank(skill, delta)
        else this.skillBonuses[skill] = (this.skillBonuses[skill] ?? 0) + delta
      }
    }
    if (reward.tags?.length) {
      if (permanent) {
        const tagsComp = self.comp(requireTagsComp(self))
        for (const tag of reward.tags) tagsComp?.addTag(tag)
      } else {
        this.scopedTags = [...new Set([...this.scopedTags, ...reward.tags])]
      }
    }
    if (reward.traits?.length) {
      const traits = ensureComponent(self, Traits, 'traits')
      for (const traitId of reward.traits) {
        const tpl = self.catalog.template(TRAIT_TEMPLATES, traitId)
        const def: ComponentDef = tpl ? { ...tpl, id: traitId, type: 'trait' } : { type: 'trait', id: traitId }
        traits.grant(def, { sourceClass: this.id, permanent })
      }
    }
    if (reward.abilities?.length) {
      const abilities = ensureComponent(self, Abilities, 'abilities')
      for (const abilityId of reward.abilities) {
        const already = abilities.find(abilityId)
        if (already) {
          if (permanent) already.params.permanent = true
          continue
        }
        const tpl = self.catalog.template(ABILITY_TEMPLATES, abilityId)
        const def: ComponentDef = tpl
          ? { ...tpl, id: abilityId, type: Ability.type, sourceClass: this.id, permanent }
          : { type: Ability.type, id: abilityId, label: abilityId, sourceClass: this.id, permanent }
        const made = createComponent(def)
        if (made instanceof Ability) abilities.add(made)
      }
    }
  }

  onApplied(): void {
    super.onApplied()
    this.syncMilestones()
    this.lastActive = this.isActive()
  }

  override saveState(): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    if (this.grantedLevels.length) out.grantedLevels = [...this.grantedLevels]
    if (Object.keys(this.statBonuses).length) out.statBonuses = { ...this.statBonuses }
    if (Object.keys(this.skillBonuses).length) out.skillBonuses = { ...this.skillBonuses }
    if (this.scopedTags.length) out.scopedTags = [...this.scopedTags]
    return out
  }

  override loadState(state: Record<string, unknown>): void {
    this.grantedLevels = Array.isArray(state.grantedLevels) ? state.grantedLevels.map(Number).filter(Number.isFinite) : []
    this.statBonuses = state.statBonuses && typeof state.statBonuses === 'object' ? { ...(state.statBonuses as Record<string, number>) } : {}
    this.skillBonuses = state.skillBonuses && typeof state.skillBonuses === 'object' ? { ...(state.skillBonuses as Record<string, number>) } : {}
    this.scopedTags = Array.isArray(state.scopedTags) ? state.scopedTags.map(String) : []
  }

  tooltipRows(): TooltipRow[] {
    const reasons = this.restrictionReasons()
    return [
      { label: 'Level', value: String(this.level) },
      { label: 'XP', value: `${this.xp} / ${this.xpNeeded()}` },
      ...(reasons.length ? [{ label: 'Restricted', value: reasons.join('; ') }] : [])
    ]
  }
}

function ensureComponent<T extends Component>(entity: GameEntity, Class: abstract new (...args: never[]) => T, type: string): T {
  const existing = entity.comp(Class as never) as T | null
  if (existing) return existing
  const made = createComponent({ type }) as T
  entity.add(made)
  return made
}

function requireTagsComp(entity: GameEntity) {
  let found = entity.comps.find((c) => c.type === 'tags') as (Component & { addTag?: (t: string) => boolean }) | undefined
  if (!found) {
    found = createComponent({ type: 'tags' }) as Component & { addTag?: (t: string) => boolean }
    entity.add(found)
  }
  return found.constructor as abstract new (...args: never[]) => Component & { addTag: (t: string) => boolean }
}

export class Classes extends Component {
  static readonly type: string = 'classes'
  static readonly LABEL: string = 'Classes'
  static readonly ICON: string = 'Award'
  static readonly DESCRIPTION: string = 'Optional character classes and specializations. Characters can hold zero, one, or multiple classes.'
  static readonly PARAMS = {}

  pendingUnlocks: PendingClassUnlock[] = []
  offeredOnce: string[] = []

  canApply(host: Component | GameEntity): true | string {
    return 'catalog' in host ? true : 'classes belong on an entity'
  }

  get held(): CharacterClass[] {
    return this.comps.filter((c): c is CharacterClass => c instanceof CharacterClass)
  }

  byId(id: string): CharacterClass | null {
    return this.held.find((c) => c.id === id) ?? null
  }

  classLevel(id: string): number {
    return this.byId(id)?.level ?? 0
  }

  hasClass(id: string, opts: { minLevel?: number; activeOnly?: boolean } = {}): boolean {
    const cls = this.byId(id)
    if (!cls) return false
    if (opts.minLevel !== undefined && cls.level < opts.minLevel) return false
    if (opts.activeOnly && !cls.isActive()) return false
    return true
  }

  isClassActive(id: string): boolean {
    const cls = this.byId(id)
    return Boolean(cls && cls.isActive())
  }

  canUnlock(id: string, opts: { flags?: Record<string, unknown>; payload?: Record<string, unknown>; bypassConditions?: boolean } = {}): { ok: boolean; reasons: string[]; def: ClassTemplateDef | null } {
    const self = this.entity
    const def = classDefOf(self, id)
    if (!self || !def) return { ok: false, reasons: [`Unknown class "${id}"`], def: null }
    if (this.hasClass(id)) return { ok: false, reasons: [`Already has ${def.label}`], def }
    if (opts.bypassConditions) return { ok: true, reasons: [], def }
    const checks: ConditionDef[] = [...def.unlockWhen]
    if (def.parentClass && !checks.some((c) => c.type === 'class' && c.id === def.parentClass)) {
      checks.unshift({ type: 'class', id: def.parentClass, minLevel: 1, activeOnly: true })
    }
    if (!checks.length) return { ok: true, reasons: [], def }
    const res = explainConditions(checks, makeConditionContext(self, { flags: opts.flags, payload: opts.payload }))
    return { ok: res.passed, reasons: res.reasons, def }
  }

  grantClass(
    id: string,
    opts: { level?: number; bypassConditions?: boolean; reason?: string; flags?: Record<string, unknown> } = {}
  ): { ok: boolean; cls?: CharacterClass; reasons?: string[] } {
    const check = this.canUnlock(id, { bypassConditions: opts.bypassConditions, flags: opts.flags })
    if (!check.ok || !check.def) return { ok: false, reasons: check.reasons }

    const cls = createComponent({
      type: CharacterClass.type,
      id,
      level: Math.max(1, Math.floor(opts.level ?? 1)),
      xp: 0
    })
    if (!(cls instanceof CharacterClass) || !this.add(cls)) {
      return { ok: false, reasons: [`Failed to add class "${id}"`] }
    }
    this.pendingUnlocks = this.pendingUnlocks.filter((p) => p.classId !== id)
    this.entity?.emit('OnClassGained', { classId: id, label: cls.title, level: cls.level, reason: opts.reason ?? '' })
    this.refreshRestrictions(opts.flags)
    return { ok: true, cls }
  }

  loseClass(id: string, reason = 'removed'): boolean {
    const self = this.entity
    const cls = this.byId(id)
    if (!self || !cls) return false
    const title = cls.title
    self.comp(Traits)?.stripClassTraits(id)
    self.comp(Abilities)?.stripClassAbilities(id)
    if (!this.remove(cls)) return false
    self.emit('OnClassLost', { classId: id, label: title, reason })
    this.refreshRestrictions()
    return true
  }

  awardXp(amount: number, opts: { classId?: string; reason?: string } = {}): number {
    const target = opts.classId ? [this.byId(opts.classId)].filter((c): c is CharacterClass => c !== null) : this.held
    for (const cls of target) cls.grantXp(amount, opts.reason ?? '')
    return target.length
  }

  acceptUnlock(classId: string): { ok: boolean; cls?: CharacterClass; reasons?: string[] } {
    this.pendingUnlocks = this.pendingUnlocks.filter((p) => p.classId !== classId)
    return this.grantClass(classId, { bypassConditions: true, reason: 'clutch_accept' })
  }

  dismissUnlock(classId: string): boolean {
    const before = this.pendingUnlocks.length
    this.pendingUnlocks = this.pendingUnlocks.filter((p) => p.classId !== classId)
    return this.pendingUnlocks.length < before
  }

  refreshRestrictions(flags?: Record<string, unknown>): void {
    for (const cls of this.held) cls.checkRestrictionChange(flags)
  }

  onApplied(): void {
    super.onApplied()
    const self = this.entity
    if (!self) return

    // Cascade full character XP equally into each owned class.
    this.bind(self, 'OnXpGained', (payload) => {
      if (!payload.cascade) return
      const amount = Number(payload.amount ?? 0)
      if (amount > 0) this.awardXp(amount, { reason: String(payload.reason ?? '') })
    })

    // Re-check class activeWhen / parent requirements whenever state shifts.
    for (const sig of ['OnClassGained', 'OnClassLost', 'OnLevelUp', 'OnTraitGained', 'OnTraitLost', 'OnStoryMoment']) {
      this.bind(self, sig, (payload) => {
        const flags = payload.flags && typeof payload.flags === 'object' ? (payload.flags as Record<string, unknown>) : undefined
        this.refreshRestrictions(flags)
      })
    }

    // Evaluate clutch unlock triggers without ever silently auto-granting a class.
    for (const signal of CLUTCH_SIGNALS) {
      this.bind(self, signal, (payload) => this.evaluateClutchTriggers(signal, payload))
    }
  }

  private evaluateClutchTriggers(signal: string, payload: Record<string, unknown>): void {
    const self = this.entity
    if (!self) return
    const flags = payload.flags && typeof payload.flags === 'object' ? (payload.flags as Record<string, unknown>) : undefined
    for (const def of classDefsOf(self)) {
      if (this.hasClass(def.id)) continue
      if (this.pendingUnlocks.some((p) => p.classId === def.id)) continue
      const matching = def.clutchTriggers.filter((t) => t.signal === signal)
      if (!matching.length) continue
      const baseOk = this.canUnlock(def.id, { flags, payload }).ok
      if (!baseOk) continue

      for (const trigger of matching) {
        const triggerKey = `${def.id}:${trigger.signal}`
        if (trigger.oncePerCharacter && this.offeredOnce.includes(triggerKey)) continue
        const ctx = makeConditionContext(self, { payload, flags, seed: `${self.uid}:clutch:${def.id}:${signal}` })
        const when = trigger.when ?? []
        if (!when.every((cond) => test(cond, ctx))) continue
        const chance = trigger.chance ?? 100
        if (chance < 100) {
          if (chance <= 0) continue
          const outcome = roll(`${self.uid}:clutch-roll:${triggerKey}`, Math.floor(Date.now() / 1000)) * 100
          if (outcome >= chance) continue
        }
        if (trigger.oncePerCharacter) this.offeredOnce.push(triggerKey)
        const offer: PendingClassUnlock = {
          classId: def.id,
          label: def.label,
          signal,
          prompt: trigger.prompt || `Unlock the ${def.label} class?`,
          triggeredAt: Date.now()
        }
        this.pendingUnlocks = [...this.pendingUnlocks, offer]
        self.emit('OnClassOffer', { ...offer })
        break
      }
    }
  }

  override saveState(): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    if (this.pendingUnlocks.length) out.pendingUnlocks = this.pendingUnlocks
    if (this.offeredOnce.length) out.offeredOnce = [...this.offeredOnce]
    return out
  }

  override loadState(state: Record<string, unknown>): void {
    this.pendingUnlocks = Array.isArray(state.pendingUnlocks) ? (state.pendingUnlocks as PendingClassUnlock[]) : []
    this.offeredOnce = Array.isArray(state.offeredOnce) ? state.offeredOnce.map(String) : []
  }

  tooltipRows(): TooltipRow[] {
    if (!this.held.length) return [{ label: 'Classes', value: 'Classless' }]
    return this.held.map((c) => ({
      label: c.title,
      value: c.isActive() ? `Lv ${c.level}` : `Lv ${c.level} (restricted)`
    }))
  }
}

registerComponent(CharacterClass)
registerComponent(Classes)
