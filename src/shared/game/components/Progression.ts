import { Component, registerComponent, type GameEntity, type TooltipRow } from '../core'

export interface XpCurveDef {
  id: string
  label: string
  xpForNext: (level: number) => number
}

const XP_CURVES: Record<string, XpCurveDef> = {
  fast: { id: 'fast', label: 'Fast (25 * L * (L + 1))', xpForNext: (l) => Math.max(50, 25 * l * (l + 1)) },
  standard: { id: 'standard', label: 'Standard (50 * L * (L + 1))', xpForNext: (l) => Math.max(100, 50 * l * (l + 1)) },
  slow: { id: 'slow', label: 'Slow (100 * L * (L + 1))', xpForNext: (l) => Math.max(200, 100 * l * (l + 1)) }
}

export function xpForNextLevel(level: number, curve = 'standard'): number {
  const cleanLevel = Math.max(1, Math.floor(level))
  const def = XP_CURVES[curve] ?? XP_CURVES.standard
  return def.xpForNext(cleanLevel)
}

export function xpCurveChoices(): string[] {
  return Object.keys(XP_CURVES)
}

export class Progression extends Component {
  static readonly type: string = 'progression'
  static readonly LABEL: string = 'Level & XP'
  static readonly ICON: string = 'Sparkles'
  static readonly DESCRIPTION: string = 'Character level and experience points. Character XP cascades equally to each owned class.'
  static readonly PARAMS = {
    level: { kind: 'number' as const, default: 1, min: 1, description: 'Current character level.' },
    xp: { kind: 'number' as const, default: 0, min: 0, description: 'Experience earned toward the next level.' },
    curve: { kind: 'choice' as const, choices: ['standard', 'fast', 'slow'], default: 'standard', description: 'How much XP each level-up requires.' }
  }

  canApply(host: Component | GameEntity): true | string {
    return 'catalog' in host ? true : 'progression belongs on an entity'
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

  get curve(): string {
    return String(this.params.curve || 'standard')
  }

  xpNeeded(): number {
    return xpForNextLevel(this.level, this.curve)
  }

  setLevel(nextLevel: number, reason = 'manual'): void {
    const prev = this.level
    const target = Math.max(1, Math.floor(nextLevel))
    if (target === prev) return
    this.level = target
    if (target > prev) {
      this.entity?.emit('OnLevelUp', { level: target, previous: prev, reason })
    }
  }

  grantXp(amount: number, reason = ''): { gained: number; levelsGained: number; level: number; xp: number } {
    const clean = Math.floor(amount)
    if (!Number.isFinite(clean) || clean <= 0) {
      return { gained: 0, levelsGained: 0, level: this.level, xp: this.xp }
    }
    const startLevel = this.level
    let currentXp = this.xp + clean
    let level = startLevel
    while (currentXp >= xpForNextLevel(level, this.curve)) {
      currentXp -= xpForNextLevel(level, this.curve)
      level += 1
    }
    this.xp = currentXp
    this.level = level
    const levelsGained = level - startLevel

    // Cascade full character XP equally into every owned class directly (works even when entity signals are not running).
    const siblingClasses = this.entity?.comps.find((c) => c.type === 'classes') as
      | (Component & { awardXp?: (n: number, opts?: { reason?: string }) => number })
      | undefined
    siblingClasses?.awardXp?.(clean, { reason })

    this.entity?.emit('OnXpGained', { amount: clean, xp: this.xp, level: this.level, reason, cascade: false })
    if (levelsGained > 0) {
      this.entity?.emit('OnLevelUp', { level: this.level, previous: startLevel, levelsGained, reason })
    }
    return { gained: clean, levelsGained, level: this.level, xp: this.xp }
  }

  tooltipRows(): TooltipRow[] {
    return [
      { label: 'Level', value: String(this.level) },
      { label: 'XP', value: `${this.xp} / ${this.xpNeeded()}` }
    ]
  }
}

registerComponent(Progression)
