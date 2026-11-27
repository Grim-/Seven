import {
  Flame,
  FlaskConical,
  Footprints,
  Heart,
  Shield,
  Sparkles,
  Swords,
  Zap,
  type LucideIcon
} from 'lucide-react'
import type { Point } from '@shared/shapes'
import {
  AddMovement,
  ApplyBuff,
  Equipment,
  Inventory,
  Item,
  RollModifier,
  usableAbilities,
  type Ability,
  type ActionPiece
} from '@shared/game/components'
import { CONDITIONS, HARM, HELP, ITEMS, LUCK, type EffectGroup } from '@shared/game/effectGroups'
import { GameEntity, type Catalog, type Component } from '@shared/game/core'
import type { BattleState } from '@shared/game/state/BattleStateMachine'
import { engine } from '../../../lib/ipc'
import { failed } from '../../../lib/notify'
import { toast } from '../../../store/toasts'

export interface SlotTheme {
  Icon: LucideIcon
  color: string
  border: string
  bg: string
  glow: string
}

const ICONS_BY_NAME: Record<string, LucideIcon> = {
  Flame,
  Footprints,
  Heart,
  Shield,
  Sparkles,
  Swords,
  FlaskConical,
  Zap
}

const GROUP_STYLES: Record<string, Omit<SlotTheme, 'Icon'>> = {
  [HARM.id]: { color: 'text-tint-red-ink', border: 'border-tint-red/70', bg: 'bg-tint-red/15', glow: 'shadow-[0_0_12px_color-mix(in_srgb,var(--color-alert)_calc(35%*var(--glow)),transparent)]' },
  [HELP.id]: { color: 'text-tint-green-ink', border: 'border-tint-green/70', bg: 'bg-tint-green/15', glow: 'shadow-[0_0_12px_color-mix(in_srgb,var(--color-ok)_calc(35%*var(--glow)),transparent)]' },
  [CONDITIONS.id]: { color: 'text-tint-purple-ink', border: 'border-tint-purple/70', bg: 'bg-tint-purple/15', glow: 'shadow-[0_0_12px_color-mix(in_srgb,var(--color-tint-purple-ink)_calc(35%*var(--glow)),transparent)]' },
  [ITEMS.id]: { color: 'text-tint-amber-ink', border: 'border-tint-amber/70', bg: 'bg-tint-amber/15', glow: 'shadow-[0_0_12px_color-mix(in_srgb,var(--color-tint-amber)_calc(35%*var(--glow)),transparent)]' },
  [LUCK.id]: { color: 'text-tint-cyan', border: 'border-tint-cyan/70', bg: 'bg-tint-cyan/15', glow: 'shadow-[0_0_12px_color-mix(in_srgb,var(--color-tint-cyan)_calc(35%*var(--glow)),transparent)]' }
}

const DEFAULT_SLOT_STYLE: Omit<SlotTheme, 'Icon'> = {
  color: 'text-tint-cyan',
  border: 'border-tint-cyan/70',
  bg: 'bg-tint-cyan/15',
  glow: 'shadow-[0_0_12px_color-mix(in_srgb,var(--color-tint-cyan)_calc(30%*var(--glow)),transparent)]'
}

/** Derives slot icon and accent styling from component `EffectGroup` and `Component.ICON` metadata rather than label text. */
export function slotThemeFor(comps: readonly Component[] | undefined, isItem = false): SlotTheme {
  const pieces = comps ?? []
  const group: EffectGroup | null =
    pieces.map((c) => (c.constructor as typeof ActionPiece).GROUP ?? null).find((g): g is EffectGroup => Boolean(g)) ?? null
  const iconName = pieces.map((c) => (c.constructor as { ICON?: string }).ICON).find((n) => n && n in ICONS_BY_NAME)
  const Icon = (iconName ? ICONS_BY_NAME[iconName] : null) ?? (isItem ? FlaskConical : group === HARM ? Swords : group === HELP ? Heart : Sparkles)
  const style = (group && GROUP_STYLES[group.id]) || (isItem ? GROUP_STYLES[HELP.id] : DEFAULT_SLOT_STYLE)
  return { Icon, ...style }
}

/** Checks whether the given character currently has the turn budget to spend an action cost. */
export function canSpendTurnCost(battle: BattleState | null, sheetId: string, cost: string): boolean {
  if (!battle || battle.status !== 'active') return true
  const active = battle.queue[battle.activeTurnIndex]
  if (!active?.isPlayer || active.id !== sheetId) return false
  if (cost === 'bonus') return !battle.economy.bonusActionUsed
  if (cost === 'free') return true
  return !battle.economy.actionUsed
}

/** Human-readable reason an ability or item cannot be spent on the current turn. */
export function turnCostDeniedReason(battle: BattleState | null, sheetId: string, cost: string): string {
  const active = battle?.queue[battle.activeTurnIndex]
  if (!active?.isPlayer || active.id !== sheetId) return 'Not your turn'
  return `${cost === 'bonus' ? 'Bonus action' : 'Action'} already used this turn`
}

export function abilityLabel(a: Ability): string {
  return String(a.params.label || a.id)
}

/** Returns true if an Ability grants tactical movement (`action.addMovement`). */
export function isMovementAbility(a: Ability): boolean {
  return a.comps.some((c) => c instanceof AddMovement)
}

/** Returns true if an Ability applies a Buff conferring a `buff.rollModifier` (`incoming`/`outgoing`). */
export function isDefenseRollAbility(a: Ability, catalog: Catalog | null): boolean {
  if (!catalog) return false
  return a.comps.some((c) => {
    if (!(c instanceof ApplyBuff)) return false
    const buffId = String(c.params.buff)
    const def = catalog.template(ApplyBuff.PARAMS.buff.templateKind, buffId)
    const comps = Array.isArray(def?.comps) ? (def.comps as Record<string, unknown>[]) : []
    return comps.some(
      (bc) =>
        bc.type === RollModifier.type &&
        String(bc.scope ?? 'incoming') === 'incoming' &&
        String(bc.mode ?? 'disadvantage') === 'disadvantage'
    )
  })
}

export function findMovementAbility(entity: GameEntity): Ability | undefined {
  return usableAbilities(entity).find(isMovementAbility)
}

export function findDefenseRollAbility(entity: GameEntity, catalog: Catalog | null): Ability | undefined {
  return usableAbilities(entity).find((a) => isDefenseRollAbility(a, catalog))
}

/** Resolves the active party combatant's real movement (Dash) and defense-roll (Dodge) abilities and turn-budget readiness. */
export function activeCombatManeuvers(
  battle: BattleState | null,
  tokens: { visitor: { sheet: string; game?: import('@shared/game/core').EntityRecord | null } }[],
  catalog: Catalog | null
): { canDash: boolean; canDodge: boolean; dashLabel: string; dodgeLabel: string } {
  if (!battle || battle.status !== 'active' || !catalog) {
    return { canDash: false, canDodge: false, dashLabel: 'DASH', dodgeLabel: 'DODGE' }
  }
  const active = battle.queue[battle.activeTurnIndex]
  if (!active?.isPlayer || !active.sheet) {
    return { canDash: false, canDodge: false, dashLabel: 'DASH', dodgeLabel: 'DODGE' }
  }
  const tok = tokens.find((t) => t.visitor.sheet === active.sheet)
  const ent = tok?.visitor.game ? GameEntity.fromRecord(tok.visitor.game, catalog) : null
  if (!ent) {
    return { canDash: false, canDodge: false, dashLabel: 'DASH', dodgeLabel: 'DODGE' }
  }
  const dash = findMovementAbility(ent)
  const dodge = findDefenseRollAbility(ent, catalog)
  return {
    canDash: Boolean(dash) && canSpendTurnCost(battle, active.sheet, String(dash?.params.action || 'action')),
    canDodge:
      Boolean(dodge) &&
      !battle.economy.isDodging &&
      canSpendTurnCost(battle, active.sheet, String(dodge?.params.action || 'action')),
    dashLabel: dash ? abilityLabel(dash) : 'DASH',
    dodgeLabel: dodge ? abilityLabel(dodge) : 'DODGE'
  }
}

/**
 * Shared ability execution path across ActionBarHud, TacticalActionDeck, and SpellBookScreen:
 * enforces combat turn economy, delegates ranged aiming, and runs world-authoritative IPC or offline sandbox use.
 */
export function runAbilityUse(opts: {
  sheet: string
  entity: GameEntity | null
  ability: Ability
  target?: { sheet?: string; creature?: string }
  at?: Point | null
  distance?: number
  world: string | null
  battle: BattleState | null
  aiming?: string | null
  onAim?: (aim: { uid: string; label: string } | null) => void
  onAimStart?: () => void
  act?: (fn: (e: GameEntity) => string | true) => void
}): boolean {
  const label = abilityLabel(opts.ability)
  const cost = String(opts.ability.params.action || 'action')
  if (!canSpendTurnCost(opts.battle, opts.sheet, cost)) {
    toast.info('Turn Economy', turnCostDeniedReason(opts.battle, opts.sheet, cost))
    return false
  }

  if (opts.entity) {
    const check = opts.ability.canUse({
      user: opts.entity,
      target: opts.entity,
      at: opts.at ?? null,
      distance: opts.distance ?? 0
    })
    if (check !== true) {
      toast.info(label, String(check))
      return false
    }
  }

  if (opts.ability.reach() > 0 && opts.onAim && !opts.target?.creature && !(opts.target?.sheet && opts.target.sheet !== opts.sheet)) {
    opts.onAim(opts.aiming === opts.ability.uid ? null : { uid: opts.ability.uid, label })
    opts.onAimStart?.()
    return true
  }

  const resolvedTarget = opts.target ?? { sheet: opts.sheet }
  if (opts.world && opts.sheet) {
    void engine('game.useAbility', {
      sheet: opts.sheet,
      ability: opts.ability.uid,
      target: resolvedTarget,
      world: opts.world,
      at: opts.at ?? null,
      distance: opts.distance ?? 0
    })
      .then((msg) => toast.info(label, msg))
      .catch(failed(`Could not use ${label}`))
    return true
  }

  if (opts.act) {
    opts.act((e) => {
      const found = usableAbilities(e).find((x) => x.uid === opts.ability.uid || x.id === opts.ability.id)
      return found ? found.use({ user: e, target: e, at: opts.at ?? null, distance: opts.distance ?? 0 }) : 'it is gone'
    })
    return true
  }

  return false
}

/** Shared item execution path across ActionBarHud and TacticalActionDeck. */
export function runItemUse(opts: {
  sheet: string
  item: Item
  target?: { sheet?: string; creature?: string }
  label: string
  world: string | null
  battle: BattleState | null
  act?: (fn: (e: GameEntity) => string | true) => void
}): boolean {
  const cost = String(opts.item.params.action || 'action')
  if (!canSpendTurnCost(opts.battle, opts.sheet, cost)) {
    toast.info('Turn Economy', turnCostDeniedReason(opts.battle, opts.sheet, cost))
    return false
  }

  if (opts.world && opts.sheet) {
    void engine('game.useItem', {
      sheet: opts.sheet,
      item: opts.item.uid,
      target: opts.target ?? { sheet: opts.sheet },
      world: opts.world,
      at: null
    })
      .then((msg) => toast.info(opts.label, msg))
      .catch(failed(`Could not use ${opts.label}`))
    return true
  }

  if (opts.act) {
    opts.act((e) => {
      const bag = e.comp(Inventory)?.items ?? []
      const worn = e.comp(Equipment)?.comps.filter((c): c is Item => c instanceof Item) ?? []
      const found = [...bag, ...worn].find((i) => i.uid === opts.item.uid || i.id === opts.item.id)
      if (!found) return 'item not found'
      if (!found.usable()) return 'item cannot be used'
      return found.use({ user: e, target: e, at: null, distance: 0 })
    })
    return true
  }

  return false
}
