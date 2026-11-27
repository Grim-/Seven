import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import {
  Flame,
  Zap,
  Shield,
  Heart,
  Sparkles,
  Swords,
  Footprints,
  MessageSquarePlus,
  Lock,
  Unlock,
  Plus,
  Minus,
  Crosshair,
  Radio,
  Layers
} from 'lucide-react'
import { actionHasGroup, Classes, Equipment, Inventory, Item, Stats, Traits, Weapon, usableAbilities, type Ability, type Trait } from '@shared/game/components'
import { HARM } from '@shared/game/effectGroups'
import { GameEntity, type Catalog } from '@shared/game/core'
import type { PlaceVisitor } from '@shared/maps'
import {
  canSpendTurnCost,
  findDefenseRollAbility,
  findMovementAbility,
  runAbilityUse,
  runItemUse,
  slotThemeFor
} from '../state/combatGate'
import { useGameState } from '../state/gameStateStore'
import { useDialogue } from '../dialogue/dialogueStore'
import { defaultDialogueTree, combatParleyDialogueTree } from '@shared/game/dialogue'
import { useGameplaySettings } from '../settings/gameplaySettingsStore'
import { isTypingTarget, matchesKeybind } from '../../../store/keybinds'
import { useLatest } from '../../../game/react/useLatest'
import { hideTip, showTip } from '../../ui/TooltipHost'
import { openMenu } from '../../ui'
import { RowList } from '../../../game/ui'
import { gameTime } from '../../game/character/panels/time'
import { useGameAct } from '../screens/useGameAct'
import {
  ACTION_DRAG_MIME,
  ACTION_SLOT_SWAP_MIME,
  clearActionSlot,
  setActionSlot,
  setCompactDragGhost,
  swapActionSlots,
  useActionSlots,
  type ActionDragPayload,
  type ActionSlotDef
} from './actionSlots'
import { itemName, itemTip } from '../screens/itemTip'
import { toast } from '../../../store/toasts'
import { cn } from '../../../lib/cn'
import { noteFailure } from '../../../store/problems'
import { readStored, writeStored } from '../../../lib/stored'

const name = (a: Ability) => String(a.params.label || a.id)

export type DeckCategory = 'ALL' | 'COMMON' | 'CLASS' | 'ITEMS' | 'PASSIVES' | 'META'

export interface TacticalActionDeckProps {
  visitor: PlaceVisitor | null
  catalog: Catalog | null
  aiming: string | null
  onAim: (aim: { uid: string; label: string } | null) => void
  selectedTargetId?: string | null
  onAttack?: (targetId: string, attackName?: string) => void
  className?: string
}

export function TacticalActionDeck({
  visitor,
  catalog,
  aiming,
  onAim,
  selectedTargetId,
  onAttack,
  className
}: TacticalActionDeckProps) {
  const [activeCategory, setActiveCategory] = useState<DeckCategory>('ALL')
  const [overIndex, setOverIndex] = useState<number | null>(null)
  
  // Configurable row count: 2, 3, or 4 rows (default 3)
  const [rowCount, setRowCount] = useState<2 | 3 | 4>(() => {
    const saved = readStored<number>('seven:action_deck:rows', 3)
    return saved === 2 || saved === 4 ? saved : 3
  })

  // Action bar lock state (prevents accidental drags when locked)
  const [isLocked, setIsLocked] = useState<boolean>(() => readStored<boolean>('seven:action_deck:locked', false) === true)

  // Combat stances / toggles
  const [nonLethal, setNonLethal] = useState(false)
  const [dualWield, setDualWield] = useState(false)
  const [rangedMode, setRangedMode] = useState(false)
  const [reactionEnabled, setReactionEnabled] = useState(true)

  const toggleRows = (delta: number) => {
    const next = Math.max(2, Math.min(4, rowCount + delta)) as 2 | 3 | 4
    setRowCount(next)
    writeStored('seven:action_deck:rows', next)
  }

  const toggleLock = () => {
    setIsLocked((prev) => {
      const next = !prev
      writeStored('seven:action_deck:locked', next)
      toast.info('Action Deck', next ? 'Deck locked: slot dragging disabled' : 'Deck unlocked: drag to reorder')
      return next
    })
  }

  const battle = useGameState((s) => s.battle)
  const tileFeet = useGameState((s) => s.tileFeet)
  const dashAction = useGameState((s) => s.dashAction)
  const dodgeAction = useGameState((s) => s.dodgeAction)
  const endTurn = useGameState((s) => s.endTurn)
  const endTurnDisplay = useGameplaySettings((s) => s.settings.keybinds.endTurn?.display ?? 'Space')

  const inCombat = Boolean(battle && battle.status === 'active')
  const activeActor = battle ? battle.queue[battle.activeTurnIndex] : null
  const isPlayerTurn = inCombat && (activeActor?.isPlayer ?? false)
  const economy = battle?.economy ?? {
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    movementRemaining: 0,
    isDodging: false
  }

  // Game act for slottable actions & items
  const sheet = visitor?.sheet ?? ''
  // Target combatant (never self)
  const targetCombatant = inCombat && selectedTargetId
    ? battle?.queue.find(
        (c) =>
          (c.id === selectedTargetId || (Boolean(c.sheet) && c.sheet === selectedTargetId)) &&
          c.id !== activeActor?.id &&
          (!sheet || c.sheet !== sheet)
      ) ?? null
    : null
  const hasGame = Boolean(visitor && visitor.game && catalog)
  const { shown, act } = useGameAct(sheet, visitor?.game ?? (null as any), catalog ?? (null as any))
  const entity = useMemo(() => {
    if (!hasGame || !shown || !catalog) return null
    return GameEntity.fromRecord(shown, catalog)
  }, [hasGame, shown, catalog])

  const abilities = useMemo(() => {
    if (!entity) return []
    return usableAbilities(entity)
  }, [entity])

  const heldClasses = useMemo(() => entity?.comp(Classes)?.held ?? [], [entity])
  const traits = useMemo<Trait[]>(() => entity?.comp(Traits)?.held ?? [], [entity])
  const classTitleOf = (classId: string) =>
    heldClasses.find((c) => c.id === classId)?.title || String(catalog?.template('game_class', classId)?.label || classId)

  const allItems = useMemo(() => {
    if (!entity) return []
    return [
      ...(entity.comp(Inventory)?.items ?? []),
      ...(entity.comp(Equipment)?.comps.filter((c): c is Item => c instanceof Item) ?? [])
    ]
  }, [entity])

  // Derive class label dynamically from held classes first, falling back to first header segment of visitor.line
  const dynamicClassName = useMemo(() => {
    const active = heldClasses.filter((c) => c.isActive())
    if (active.length === 1) return active[0].title.toUpperCase()
    if (active.length > 1) return `${active[0].title.toUpperCase()} +${active.length - 1}`
    if (heldClasses.length > 0) return heldClasses[0].title.toUpperCase()
    const head = (visitor?.line.split(',')[0] ?? '').trim()
    return head ? head.toUpperCase() : 'CLASS'
  }, [heldClasses, visitor?.line])

  // Active buffs & conditions from visitor dnd stats
  const activeConditions = useMemo(() => {
    const list: string[] = []
    if (economy.isDodging) list.push('DODGING')
    if (nonLethal) list.push('NON-LETHAL')
    if (visitor?.dnd?.conditions) {
      list.push(...visitor.dnd.conditions.map((c) => c.toUpperCase()))
    }
    return list
  }, [economy.isDodging, nonLethal, visitor?.dnd?.conditions])

  // Dynamic slot grid counts based on rowCount:
  // Class slots: 8 columns x rowCount (16, 24, 32)
  // Item slots: 2 columns x rowCount (4, 6, 8)
  const classCols = 8
  const classSlotCount = classCols * rowCount
  const itemSlotCount = 2 * rowCount

  const slots = useActionSlots(sheet || null, abilities, 48)

  const world = useGameState((s) => s.world)

  const strikeAbility = useMemo(
    () =>
      abilities.find(
        (a) =>
          actionHasGroup(a, HARM) &&
          (rangedMode ? a.reach() > tileFeet : Boolean(a.item?.comps.some((c) => c instanceof Weapon)) || a.params.unarmedOnly || a.reach() <= tileFeet)
      ) ?? abilities.find((a) => actionHasGroup(a, HARM)),
    [abilities, rangedMode, tileFeet]
  )
  const dashAbility = useMemo(() => (entity ? findMovementAbility(entity) : undefined), [entity])
  const dodgeAbility = useMemo(() => (entity ? findDefenseRollAbility(entity, catalog ?? null) : undefined), [entity, catalog])

  const useSlot = (slot: ActionSlotDef | null) => {
    if (!slot) return
    if (slot.kind === 'ability') {
      const a = abilities.find((x) => x.uid === slot.uid || x.id === slot.id)
      if (!a) return
      runAbilityUse({
        sheet,
        entity,
        ability: a,
        world,
        battle,
        aiming,
        onAim,
        act
      })
    } else if (slot.kind === 'item') {
      const foundItem = allItems.find((i) => i.uid === slot.uid || i.id === slot.id)
      if (!foundItem) return
      runItemUse({
        sheet,
        item: foundItem,
        label: itemName(foundItem),
        world,
        battle,
        act
      })
    }
  }

  // Maneuver triggers using actor's real abilities & turn economy
  const executeStrike = () => {
    if (!strikeAbility) {
      toast.info('No Attack', 'No usable attack ability found.')
      return
    }
    const cost = String(strikeAbility.params.action || 'action')
    if (!canSpendTurnCost(battle, sheet, cost)) {
      toast.info('Turn Economy', !isPlayerTurn ? 'Not your turn' : 'Action already used this turn')
      return
    }
    if (!inCombat || !targetCombatant) {
      onAim(aiming === strikeAbility.uid ? null : { uid: strikeAbility.uid, label: name(strikeAbility) })
      return
    }
    if (onAttack) onAttack(targetCombatant.id, strikeAbility.uid)
  }

  const executeDash = () => {
    if (!inCombat) {
      toast.info('Combat Only', 'Dash is used during tactical combat turns')
      return
    }
    const cost = String(dashAbility?.params.action || 'action')
    if (!canSpendTurnCost(battle, sheet, cost)) {
      toast.info('Turn Economy', !isPlayerTurn ? 'Not your turn' : `${cost === 'bonus' ? 'Bonus action' : 'Action'} already used this turn`)
      return
    }
    void dashAction()
  }

  const executeDodge = () => {
    if (!inCombat) {
      toast.info('Combat Only', 'Dodge is used during tactical combat turns')
      return
    }
    const cost = String(dodgeAbility?.params.action || 'action')
    if (!canSpendTurnCost(battle, sheet, cost) || economy.isDodging) return
    void dodgeAction()
  }

  const executeParley = () => {
    if (targetCombatant) {
      const tree = inCombat
        ? combatParleyDialogueTree(targetCombatant.id, targetCombatant.name)
        : defaultDialogueTree(targetCombatant.id, targetCombatant.name)
      useDialogue.getState().startDialogue(tree, targetCombatant.name)
    } else {
      toast.info('Parley', 'Select a target entity to open diplomatic communications')
    }
  }

  // Hotkey navigation
  const latestRef = useLatest({
    isPlayerTurn,
    inCombat,
    targetCombatant,
    executeStrike,
    executeDash,
    executeDodge,
    executeParley,
    endTurn
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || isTypingTarget(e)) return
      const k = e.key.toLowerCase()

      if (k === '1' || matchesKeybind('tactical.targetAttack', e)) {
        if (latestRef.current.inCombat && latestRef.current.isPlayerTurn) {
          e.preventDefault()
          latestRef.current.executeStrike()
        }
      } else if (k === '2' || matchesKeybind('tactical.dash', e)) {
        if (latestRef.current.inCombat && latestRef.current.isPlayerTurn) {
          e.preventDefault()
          latestRef.current.executeDash()
        }
      } else if (k === '3' || matchesKeybind('tactical.dodge', e)) {
        if (latestRef.current.inCombat && latestRef.current.isPlayerTurn) {
          e.preventDefault()
          latestRef.current.executeDodge()
        }
      } else if (matchesKeybind('tactical.parley', e)) {
        if (latestRef.current.targetCombatant) {
          e.preventDefault()
          latestRef.current.executeParley()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [latestRef])

  // Drag and drop handlers
  const handleMenu = (e: MouseEvent, index: number, slot: ActionSlotDef) => {
    if (isLocked) return
    e.preventDefault()
    e.stopPropagation()
    openMenu(e, slot.label, [
      {
        label: 'Clear Slot',
        danger: true,
        onSelect: () => clearActionSlot(sheet, index, 48)
      }
    ])
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (isLocked) return
    if (
      e.dataTransfer.types.includes(ACTION_DRAG_MIME) ||
      e.dataTransfer.types.includes(ACTION_SLOT_SWAP_MIME)
    ) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setOverIndex(index)
    }
  }

  const handleDragLeave = (index: number) => {
    setOverIndex((prev) => (prev === index ? null : prev))
  }

  const handleDrop = (e: React.DragEvent, index: number) => {
    if (isLocked) return
    e.preventDefault()
    setOverIndex(null)

    // Slot swapping
    const swapRaw = e.dataTransfer.getData(ACTION_SLOT_SWAP_MIME)
    if (swapRaw) {
      try {
        const data = JSON.parse(swapRaw)
        if (typeof data.index === 'number' && data.index !== index) {
          swapActionSlots(sheet, data.index, index, 48)
          return
        }
      } catch (err) {
        noteFailure('play', 'Could not read the dragged slot')(err)
      }
    }

    // Drag from Spellbook or Inventory
    const actionRaw = e.dataTransfer.getData(ACTION_DRAG_MIME)
    if (actionRaw) {
      try {
        const data = JSON.parse(actionRaw) as ActionDragPayload
        setActionSlot(
          sheet,
          index,
          {
            kind: data.kind,
            uid: data.uid,
            id: data.id,
            label: data.label
          },
          48
        )
        toast.info('Action Deck', `Bound ${data.label} to Slot ${index + 1}`)
      } catch (err) {
        noteFailure('play', 'Could not read the dragged action')(err)
      }
    }
  }

  const timeDef = useGameState((s) => s.timeDef)
  const speedStat = timeDef?.speedStat ?? ''
  const defaultSpeed = speedStat ? (catalog?.stat(speedStat)?.default ?? 0) : 0
  const maxSpeed = activeActor?.speedMax ?? (speedStat ? entity?.comp(Stats)?.value(speedStat) : undefined) ?? defaultSpeed
  const speedRem = inCombat ? economy.movementRemaining : maxSpeed
  const speedPercent = Math.max(0, Math.min(100, (speedRem / Math.max(1, maxSpeed)) * 100))

  return (
    <div
      className={cn(
        'pointer-events-auto absolute bottom-2 left-1/2 -translate-x-1/2 z-40 flex flex-col font-ui select-none shadow-[0_24px_60px_color-mix(in_srgb,var(--color-shade)_98%,transparent)] backdrop-blur-[calc(var(--panel-blur)*1.5)]',
        className
      )}
    >
      {/* OPTIONAL PASSIVE TRAITS DRAWER (SHOWN WHEN PASSIVES TAB IS SELECTED) */}
      {activeCategory === 'PASSIVES' && (
        <div className="mb-1 flex flex-wrap items-center gap-1 border border-line/70 tone-panel-95 px-2 py-1.5 text-[9.5px]">
          <span className="mr-1 font-bold caps-5 text-tint-purple">Traits</span>
          {traits.length === 0 ? (
            <span className="text-faint">No innate or class traits active.</span>
          ) : (
            traits.map((t) => {
              const active = t.isActive()
              const sig = String(t.params.signal || '')
              const maxUses = Number(t.params.maxUses ?? 0)
              const classTitle = t.sourceClass ? classTitleOf(t.sourceClass) : ''
              const tipBody = (
                <span className="flex min-w-44 flex-col gap-1.5">
                  {Boolean(t.params.description) && <span className="text-[11px] text-dim">{String(t.params.description)}</span>}
                  {classTitle && <span className="font-ui text-[10px] text-tint-cyan">from class {classTitle}</span>}
                  <RowList
                    rows={[
                      ...(maxUses > 0 ? [{ label: 'Uses', value: `${Math.max(0, maxUses - t.uses)}/${maxUses}` }] : []),
                      ...t.tooltipRows(),
                      ...t.comps.flatMap((c) => c.tooltipRows())
                    ]}
                  />
                </span>
              )
              return (
                <span
                  key={t.uid}
                  onMouseEnter={(e) => showTip(e.currentTarget, t.title, tipBody, 'top')}
                  onMouseLeave={() => hideTip('component')}
                  className={cn(
                    'inline-flex items-center gap-1 border px-1.5 py-0.5 font-ui text-[9px] transition-colors',
                    active ? 'border-tint-purple/50 bg-tint-purple/10 text-ink' : 'border-line/40 tone-panel-60 text-faint opacity-60'
                  )}
                >
                  <Sparkles className={cn('h-2.5 w-2.5', active ? 'text-tint-purple' : 'text-faint')} />
                  <span className="font-semibold">{t.title}</span>
                  {classTitle && <span className="text-[8px] caps text-tint-cyan">[{classTitle}]</span>}
                  {sig && <span className="text-[8px] text-dim">{sig}</span>}
                  {t.cooldownLeft > 0 && <span className="text-[8px] text-alert">{gameTime(t.cooldownLeft)}</span>}
                  {t.exhausted && <span className="text-[8px] text-alert caps">Used</span>}
                </span>
              )
            })
          )}
        </div>
      )}

      {/* 1. TOP SHELF: RESOURCE TELEMETRY, SPELL MATRIX & ACTIVE BUFF DOCK */}
      <div className="flex h-7 items-center justify-between border border-line/70 border-b-0 tone-well-95 px-2.5 text-[10px]">
        {/* LEFT: ACTION ECONOMY STATUS PIPS */}
        <div className="flex items-center gap-3">
          {/* ACTION PIP */}
          <div
            className={cn(
              'flex items-center gap-1 font-bold',
              !economy.actionUsed ? 'text-ok' : 'text-faint line-through opacity-40'
            )}
            title="Standard Action: Used for attacks, spells, and maneuvers"
          >
            <span className={cn('h-2.5 w-2.5 rounded-none', !economy.actionUsed ? 'bg-ok shadow-[0_0_8px_color-mix(in_srgb,var(--color-tint-green)_calc(80%*var(--glow)),transparent)]' : 'border border-line/40 tone-panel-60')} />
            <span>ACTION</span>
          </div>

          {/* BONUS ACTION PIP */}
          <div
            className={cn(
              'flex items-center gap-1 font-bold',
              !economy.bonusActionUsed ? 'text-accent' : 'text-faint line-through opacity-40'
            )}
            title="Bonus Action: Swift abilities, off-hand strikes, and secondary spells"
          >
            <span className={cn('h-2.5 w-2.5 rounded-none rotate-45', !economy.bonusActionUsed ? 'bg-accent shadow-[0_0_8px_color-mix(in_srgb,rgb(255,160,0)_calc(80%*var(--glow)),transparent)]' : 'border border-line/40 tone-panel-60')} />
            <span>BONUS</span>
          </div>

          {/* REACTION PIP */}
          <div
            className={cn(
              'flex items-center gap-1 font-bold',
              reactionEnabled && !economy.reactionUsed ? 'text-tint-purple' : 'text-faint line-through opacity-40'
            )}
            title="Reaction: Opportunity attacks, shield counters, and ripostes"
          >
            <span className={cn('h-2.5 w-2.5 rounded-none', reactionEnabled && !economy.reactionUsed ? 'bg-tint-purple shadow-[0_0_8px_color-mix(in_srgb,rgb(180,100,255)_calc(80%*var(--glow)),transparent)]' : 'border border-line/40 tone-panel-60')} />
            <span>REACT</span>
          </div>

          {/* CLASS CHARGES / ENERGY COUNTER */}
          <div
            className="flex items-center gap-1 border-l border-line/50 pl-2.5 text-tint-amber-ink font-bold"
            title="Class Charges / Tactical Power / Focus"
          >
            <Flame className="h-3 w-3" />
            <span className="text-[11px] font-extrabold tracking-tight">8</span>
            <span className="text-[8px] text-tint-amber/80 caps">Focus</span>
          </div>
        </div>

        {/* CENTER: ROMAN NUMERAL SPELL SLOT MATRIX */}
        <div className="flex items-center gap-2.5 text-[9px] text-dim">
          <div className="flex items-center gap-0.5">
            <span className="text-tint-cyan font-bold mr-0.5">I</span>
            <span className="flex gap-0.5">
              <span className="h-2 w-2 border border-tint-cyan/60 bg-tint-cyan shadow-[0_0_6px_color-mix(in_srgb,rgb(0,216,246)_calc(60%*var(--glow)),transparent)]" />
              <span className="h-2 w-2 border border-tint-cyan/60 bg-tint-cyan shadow-[0_0_6px_color-mix(in_srgb,rgb(0,216,246)_calc(60%*var(--glow)),transparent)]" />
              <span className="h-2 w-2 border border-tint-cyan/60 bg-tint-cyan shadow-[0_0_6px_color-mix(in_srgb,rgb(0,216,246)_calc(60%*var(--glow)),transparent)]" />
              <span className="h-2 w-2 border border-tint-cyan/60 bg-tint-cyan shadow-[0_0_6px_color-mix(in_srgb,rgb(0,216,246)_calc(60%*var(--glow)),transparent)]" />
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <span className="text-tint-cyan font-bold mr-0.5">II</span>
            <span className="flex gap-0.5">
              <span className="h-2 w-2 border border-tint-cyan/60 bg-tint-cyan shadow-[0_0_6px_color-mix(in_srgb,rgb(0,216,246)_calc(60%*var(--glow)),transparent)]" />
              <span className="h-2 w-2 border border-tint-cyan/60 bg-tint-cyan shadow-[0_0_6px_color-mix(in_srgb,rgb(0,216,246)_calc(60%*var(--glow)),transparent)]" />
              <span className="h-2 w-2 border border-tint-cyan/60 bg-tint-cyan shadow-[0_0_6px_color-mix(in_srgb,rgb(0,216,246)_calc(60%*var(--glow)),transparent)]" />
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <span className="text-tint-cyan font-bold mr-0.5">III</span>
            <span className="flex gap-0.5">
              <span className="h-2 w-2 border border-tint-cyan/60 bg-tint-cyan shadow-[0_0_6px_color-mix(in_srgb,rgb(0,216,246)_calc(60%*var(--glow)),transparent)]" />
              <span className="h-2 w-2 border border-tint-cyan/60 bg-tint-cyan shadow-[0_0_6px_color-mix(in_srgb,rgb(0,216,246)_calc(60%*var(--glow)),transparent)]" />
            </span>
          </div>
          <div className="flex items-center gap-0.5 text-faint">
            <span className="font-bold mr-0.5">IV</span>
            <span className="flex gap-0.5">
              <span className="h-2 w-2 border border-line/40 tone-panel-40" />
            </span>
          </div>
        </div>

        {/* RIGHT: CONCENTRATION & ACTIVE BUFF STATUS SHELF */}
        <div className="flex items-center gap-2">
          {activeConditions.length > 0 ? (
            <div className="flex items-center gap-1">
              {activeConditions.map((cond) => (
                <span
                  key={cond}
                  className="flex items-center gap-1 border border-accent/60 bg-accent/15 px-1 py-0.2 text-[8px] font-bold text-accent"
                >
                  <span className="h-1.5 w-1.5 bg-accent animate-pulse" />
                  {cond}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[8px] caps-5 text-faint">
              STABLE CONCENTRATION
            </span>
          )}

          <div className="flex items-center gap-1 border-l border-line/50 pl-2 text-tint-cyan">
            <Footprints className="h-3 w-3" />
            <strong className={speedRem > 0 ? 'text-tint-cyan font-extrabold' : 'text-faint'}>
              {speedRem}/{maxSpeed} FT
            </strong>
          </div>
        </div>
      </div>

      {/* 2. MAIN MODULAR ACTION DECK (DYNAMIC ROWS: 2, 3, or 4) */}
      <div className="flex border border-line/70 tone-panel-95 p-1 gap-1">
        {/* PANEL 1: COMMON MANEUVERS & META ACTIONS (2 COLS X rowCount ROWS) */}
        <div
          className={cn(
            'grid grid-cols-2 gap-1 transition-opacity',
            rowCount === 2 ? 'grid-rows-2' : rowCount === 3 ? 'grid-rows-3' : 'grid-rows-4',
            activeCategory !== 'ALL' && activeCategory !== 'COMMON' && activeCategory !== 'META'
              ? 'opacity-30'
              : 'opacity-100'
          )}
        >
          {/* 1. STRIKE (ATTACK) */}
          {(() => {
            const strikeCost = String(strikeAbility?.params.action || 'action')
            const canStrike = Boolean(strikeAbility) && (!inCombat || canSpendTurnCost(battle, sheet, strikeCost))
            const strikeAiming = Boolean(aiming && strikeAbility && aiming === strikeAbility.uid)
            const strikeBadge = strikeCost === 'bonus' ? 'BON' : strikeCost === 'free' ? 'FREE' : 'ACT'
            return (
              <button
                type="button"
                onClick={executeStrike}
                disabled={!canStrike}
                title={
                  targetCombatant
                    ? `${strikeAbility ? name(strikeAbility) : 'Attack'} ${targetCombatant.name} (${strikeBadge} · [1/F])`
                    : `${strikeAbility ? name(strikeAbility) : 'Attack'} — click to aim, then pick a target (${strikeBadge} · [1/F])`
                }
                className={cn(
                  'group relative flex h-9 w-9 items-center justify-center border font-ui text-[10px] font-bold transition-all',
                  strikeAiming
                    ? 'border-tint-cyan bg-tint-cyan/30 text-tint-cyan shadow-[0_0_14px_color-mix(in_srgb,rgb(0,216,246)_calc(80%*var(--glow)),transparent)] animate-pulse cursor-pointer'
                    : canStrike
                    ? 'border-tint-red/70 bg-tint-red/15 text-tint-red-ink hover:border-tint-red-ink hover:scale-105 cursor-pointer shadow-[0_0_10px_color-mix(in_srgb,var(--color-alert)_calc(25%*var(--glow)),transparent)]'
                    : 'border-line/40 tone-panel-60 text-faint cursor-not-allowed'
                )}
              >
                <Swords className="h-4 w-4" />
                <span className="absolute bottom-0.5 left-0.5 text-[7.5px] font-extrabold text-ink/80">1</span>
                <span className="absolute top-0.5 right-0.5 text-[7px] text-tint-red-ink">{strikeBadge}</span>
              </button>
            )
          })()}

          {/* 2. DASH */}
          {(() => {
            const dashCost = String(dashAbility?.params.action || 'action')
            const canDash = Boolean(dashAbility) && (!inCombat || canSpendTurnCost(battle, sheet, dashCost))
            const dashBadge = dashCost === 'bonus' ? 'BON' : dashCost === 'free' ? 'FREE' : 'ACT'
            return (
              <button
                type="button"
                onClick={executeDash}
                disabled={!canDash && inCombat}
                title={`${dashAbility ? name(dashAbility) : 'Dash'} (${dashBadge} · [2/C])`}
                className={cn(
                  'group relative flex h-9 w-9 items-center justify-center border font-ui text-[10px] font-bold transition-all',
                  canDash
                    ? 'border-line/60 tone-well-60 text-ink hover:border-tint-cyan hover:text-tint-cyan hover:scale-105 cursor-pointer'
                    : 'border-line/30 tone-panel-40 text-faint cursor-not-allowed'
                )}
              >
                <Footprints className="h-4 w-4 text-tint-cyan" />
                <span className="absolute bottom-0.5 left-0.5 text-[7.5px] font-extrabold text-ink/80">C</span>
                <span className="absolute top-0.5 right-0.5 text-[7px] text-tint-cyan">{dashBadge}</span>
              </button>
            )
          })()}

          {/* 3. DODGE */}
          {(() => {
            const dodgeCost = String(dodgeAbility?.params.action || 'action')
            const canDodge = Boolean(dodgeAbility) && (!inCombat || canSpendTurnCost(battle, sheet, dodgeCost)) && !economy.isDodging
            const dodgeBadge = dodgeCost === 'bonus' ? 'BON' : dodgeCost === 'free' ? 'FREE' : 'ACT'
            return (
              <button
                type="button"
                onClick={executeDodge}
                disabled={inCombat && !canDodge}
                title={`${dodgeAbility ? name(dodgeAbility) : 'Dodge'} (${dodgeBadge} · [3/Z])`}
                className={cn(
                  'group relative flex h-9 w-9 items-center justify-center border font-ui text-[10px] font-bold transition-all',
                  economy.isDodging
                    ? 'border-accent bg-accent/20 text-accent cursor-default'
                    : canDodge
                    ? 'border-line/60 tone-well-60 text-ink hover:border-accent hover:text-accent hover:scale-105 cursor-pointer'
                    : 'border-line/30 tone-panel-40 text-faint cursor-not-allowed'
                )}
              >
                <Shield className="h-4 w-4 text-accent" />
                <span className="absolute bottom-0.5 left-0.5 text-[7.5px] font-extrabold text-ink/80">Z</span>
                <span className="absolute top-0.5 right-0.5 text-[7px] text-accent">{dodgeBadge}</span>
              </button>
            )
          })()}

          {/* 4. PARLEY (META DIALOGUE) */}
          <button
            type="button"
            onClick={executeParley}
            disabled={!targetCombatant}
            title={
              targetCombatant
                ? `Parley: Negotiate, intimidate, or deceive ${targetCombatant.name} (Meta · [P])`
                : 'Parley: Select an entity to open emergent dialogue (Meta · [P])'
            }
            className={cn(
              'group relative flex h-9 w-9 items-center justify-center border font-ui text-[10px] font-bold transition-all',
              targetCombatant
                ? 'border-tint-purple/70 bg-tint-purple/15 text-tint-purple hover:border-tint-purple hover:bg-tint-purple hover:text-on-accent hover:scale-105 cursor-pointer shadow-[0_0_10px_color-mix(in_srgb,rgb(180,100,255)_calc(30%*var(--glow)),transparent)]'
                : 'border-line/30 tone-panel-40 text-faint cursor-not-allowed'
            )}
          >
            <MessageSquarePlus className="h-4 w-4 text-tint-purple" />
            <span className="absolute bottom-0.5 left-0.5 text-[7.5px] font-extrabold text-tint-purple">P</span>
            <span className="absolute top-0.5 right-0.5 text-[7px] text-tint-purple caps">Meta</span>
          </button>
        </div>

        {/* MCRN TERMINAL DIVIDER 1 (RED ACCENT GRIPPER) */}
        <div className="flex flex-col items-center justify-center px-0.5 cursor-col-resize select-none">
          <div className="h-full w-1 flex flex-col items-center justify-center gap-1 border-l border-r border-tint-red/30 bg-tint-red/5">
            <span className="h-1 w-0.5 bg-tint-red/60" />
            <span className="h-1 w-0.5 bg-tint-red/60" />
            <span className="h-1 w-0.5 bg-tint-red/60" />
          </div>
        </div>

        {/* PANEL 2: CLASS ABILITIES & SPELLS (8 COLS X rowCount ROWS) */}
        <div
          className={cn(
            'grid grid-cols-8 gap-1 transition-opacity',
            rowCount === 2 ? 'grid-rows-2' : rowCount === 3 ? 'grid-rows-3' : 'grid-rows-4',
            activeCategory !== 'ALL' && activeCategory !== 'CLASS'
              ? 'opacity-30'
              : 'opacity-100'
          )}
        >
          {Array.from({ length: classSlotCount }).map((_, i) => {
            const slotIndex = i // indices 0..classSlotCount - 1
            const slot = slots[slotIndex]
            const isOver = overIndex === slotIndex

            if (!slot) {
              return (
                <div
                  key={`empty-${slotIndex}`}
                  onDragOver={(e) => handleDragOver(e, slotIndex)}
                  onDragLeave={() => handleDragLeave(slotIndex)}
                  onDrop={(e) => handleDrop(e, slotIndex)}
                  className={cn(
                    'relative flex h-9 w-9 select-none items-center justify-center border font-ui transition-all',
                    isOver
                      ? 'border-tint-cyan bg-tint-cyan/25 scale-105 shadow-[0_0_12px_color-mix(in_srgb,rgb(0,216,246)_calc(50%*var(--glow)),transparent)]'
                      : 'border-line/40 tone-well-60 hover:border-line'
                  )}
                  title={`Class Slot ${i + 1} (${isLocked ? 'Locked' : 'Empty · Drag ability here'})`}
                >
                  <span className="text-[10px] text-line-strong/20 font-ui">+</span>
                </div>
              )
            }

            if (slot.kind === 'ability') {
              const a = abilities.find((x) => x.uid === slot.uid || x.id === slot.id)
              const sourceClass = String(a?.params.sourceClass || '')
              const sourceClassTitle = sourceClass ? classTitleOf(sourceClass) : ''
              const ready = a && entity ? a.canUse({ user: entity, target: entity, at: null, distance: 0 }) : 'restricted or unavailable'
              const rows = a && catalog
                ? [
                    ...Object.entries(a.cost).map(([s, n]) => ({ label: catalog.stat(s)?.label ?? s, value: String(n) })),
                    ...a.comps.flatMap((c) => c.tooltipRows())
                  ]
                : []
              const body = (
                <span className="flex min-w-44 flex-col gap-1.5">
                  {sourceClassTitle && (
                    <span className="font-ui text-[10px] text-tint-cyan">
                      from class {sourceClassTitle}
                    </span>
                  )}
                  {a?.item && (
                    <span className="font-ui text-[10px] text-tint-purple">
                      from {String(a.item.params.label || a.item.id)}
                    </span>
                  )}
                  <RowList rows={[{ label: 'Range', value: a && a.reach() ? `${a.reach()} ft` : 'self' }, ...rows]} />
                  {ready !== true && <span className="text-[11px] text-alert">{ready}</span>}
                  {!isLocked && (
                    <span className="border-t border-line/40 pt-1 text-[9.5px] text-faint">
                      Right-click to clear slot
                    </span>
                  )}
                </span>
              )

              const label = a ? name(a) : slot.label
              const theme = slotThemeFor(a?.comps)
              const Icon = theme.Icon
              const isUpcastable = Boolean(a && Object.keys(a.cost).length > 0)
              const canSpendCost = a ? canSpendTurnCost(battle, sheet, String(a.params.action || 'action')) : true
              const slotAvailable = ready === true && canSpendCost

              return (
                <button
                  key={`ability-${slotIndex}`}
                  type="button"
                  draggable={!isLocked}
                  onDragStart={(e) => {
                    if (isLocked) return
                    hideTip('component')
                    e.dataTransfer.setData(
                      ACTION_SLOT_SWAP_MIME,
                      JSON.stringify({ index: slotIndex, sheet })
                    )
                    e.dataTransfer.effectAllowed = 'move'
                    setCompactDragGhost(e, label, '#00d8f6')
                  }}
                  onDragOver={(e) => handleDragOver(e, slotIndex)}
                  onDragLeave={() => handleDragLeave(slotIndex)}
                  onDrop={(e) => handleDrop(e, slotIndex)}
                  onClick={() => useSlot(slot)}
                  onContextMenu={(e) => handleMenu(e, slotIndex, slot)}
                  onMouseEnter={(e) => showTip(e.currentTarget, label, body, 'top')}
                  onMouseLeave={() => hideTip('component')}
                  className={cn(
                    'group relative flex h-9 w-9 items-center justify-center border font-ui text-[10px] font-bold transition-all',
                    isLocked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
                    isOver && 'border-tint-cyan bg-tint-cyan/25 scale-105 shadow-[0_0_12px_color-mix(in_srgb,rgb(0,216,246)_calc(60%*var(--glow)),transparent)]',
                    slotAvailable
                      ? cn(theme.border, theme.bg, theme.color, 'hover:scale-105 hover:border-tint-cyan')
                      : 'border-line/40 tone-panel-60 text-faint opacity-50',
                    aiming && a && aiming === a.uid && 'border-tint-cyan bg-tint-cyan/30 text-tint-cyan shadow-[0_0_14px_color-mix(in_srgb,rgb(0,216,246)_calc(80%*var(--glow)),transparent)] animate-pulse'
                  )}
                >
                  <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />

                  {sourceClassTitle && (
                    <span
                      className="absolute bottom-0.5 left-0.5 border border-tint-cyan/40 tone-panel-85 px-0.5 text-[6.5px] font-bold caps text-tint-cyan leading-none"
                      title={`Class ability: ${sourceClassTitle}`}
                    >
                      {sourceClassTitle.slice(0, 3)}
                    </span>
                  )}

                  {/* UPCAST / TIER INDICATOR BADGE (+) */}
                  {isUpcastable && (
                    <span
                      className="absolute top-0.5 right-0.5 text-[8px] font-extrabold text-tint-cyan/90 leading-none"
                      title="Tier / Variable Upcast"
                    >
                      +
                    </span>
                  )}

                </button>
              )
            }

            return null
          })}
        </div>

        {/* MCRN TERMINAL DIVIDER 2 (RED ACCENT GRIPPER) */}
        <div className="flex flex-col items-center justify-center px-0.5 cursor-col-resize select-none">
          <div className="h-full w-1 flex flex-col items-center justify-center gap-1 border-l border-r border-tint-red/30 bg-tint-red/5">
            <span className="h-1 w-0.5 bg-tint-red/60" />
            <span className="h-1 w-0.5 bg-tint-red/60" />
            <span className="h-1 w-0.5 bg-tint-red/60" />
          </div>
        </div>

        {/* PANEL 3: CONSUMABLES & ITEMS (2 COLS X rowCount ROWS) */}
        <div
          className={cn(
            'grid grid-cols-2 gap-1 transition-opacity',
            rowCount === 2 ? 'grid-rows-2' : rowCount === 3 ? 'grid-rows-3' : 'grid-rows-4',
            activeCategory !== 'ALL' && activeCategory !== 'ITEMS'
              ? 'opacity-30'
              : 'opacity-100'
          )}
        >
          {Array.from({ length: itemSlotCount }).map((_, i) => {
            const slotIndex = 32 + i // offset for items
            const slot = slots[slotIndex]
            const isOver = overIndex === slotIndex

            if (!slot) {
              return (
                <div
                  key={`empty-item-${slotIndex}`}
                  onDragOver={(e) => handleDragOver(e, slotIndex)}
                  onDragLeave={() => handleDragLeave(slotIndex)}
                  onDrop={(e) => handleDrop(e, slotIndex)}
                  className={cn(
                    'relative flex h-9 w-9 select-none items-center justify-center border font-ui transition-all',
                    isOver
                      ? 'border-tint-cyan bg-tint-cyan/25 scale-105 shadow-[0_0_12px_color-mix(in_srgb,rgb(0,216,246)_calc(50%*var(--glow)),transparent)]'
                      : 'border-line/40 tone-well-60 hover:border-line'
                  )}
                  title={`Item Slot ${i + 1} (${isLocked ? 'Locked' : 'Empty · Drag item here'})`}
                >
                  <span className="text-[10px] text-line-strong/20 font-ui">+</span>
                </div>
              )
            }

            const item = allItems.find((x) => x.uid === slot.uid || x.id === slot.id)
            const tip = item ? itemTip(item) : null
            const itemLabel = item ? itemName(item) : slot.label
            const count = item?.count ?? 0
            const theme = slotThemeFor(item?.comps, true)
            const Icon = theme.Icon

            return (
              <button
                key={`item-${slotIndex}`}
                type="button"
                draggable={!isLocked}
                onDragStart={(e) => {
                  if (isLocked) return
                  hideTip('component')
                  e.dataTransfer.setData(
                    ACTION_SLOT_SWAP_MIME,
                    JSON.stringify({ index: slotIndex, sheet })
                  )
                  e.dataTransfer.effectAllowed = 'move'
                  setCompactDragGhost(e, itemLabel, '#38bdf8')
                }}
                onDragOver={(e) => handleDragOver(e, slotIndex)}
                onDragLeave={() => handleDragLeave(slotIndex)}
                onDrop={(e) => handleDrop(e, slotIndex)}
                onClick={() => useSlot(slot)}
                onContextMenu={(e) => handleMenu(e, slotIndex, slot)}
                onMouseEnter={(e) =>
                  tip
                    ? showTip(
                        e.currentTarget,
                        tip.title,
                        <span className="flex flex-col gap-1.5">
                          {tip.body}
                          {!isLocked && (
                            <span className="border-t border-line/40 pt-1 text-[9.5px] text-faint">
                              Right-click to clear
                            </span>
                          )}
                        </span>,
                        'top'
                      )
                    : undefined
                }
                onMouseLeave={() => hideTip('component')}
                className={cn(
                  'group relative flex h-9 w-9 items-center justify-center border font-ui text-[10px] font-bold transition-all',
                  isLocked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
                  isOver && 'border-tint-cyan bg-tint-cyan/25 scale-105 shadow-[0_0_12px_color-mix(in_srgb,rgb(0,216,246)_calc(60%*var(--glow)),transparent)]',
                  item && item.usable()
                    ? cn(theme.border, theme.bg, theme.color, 'hover:scale-105 hover:border-tint-cyan')
                    : 'border-line/40 tone-panel-60 text-faint'
                )}
              >
                <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
                {count > 1 && (
                  <span className="absolute right-0.5 bottom-0.5 border border-accent/40 tone-panel-90 px-0.5 text-[7.5px] font-bold text-accent">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* MCRN TERMINAL DIVIDER 3 (RED ACCENT GRIPPER) */}
        <div className="flex flex-col items-center justify-center px-0.5 cursor-col-resize select-none">
          <div className="h-full w-1 flex flex-col items-center justify-center gap-1 border-l border-r border-tint-red/30 bg-tint-red/5">
            <span className="h-1 w-0.5 bg-tint-red/60" />
            <span className="h-1 w-0.5 bg-tint-red/60" />
            <span className="h-1 w-0.5 bg-tint-red/60" />
          </div>
        </div>

        {/* PANEL 4: WEAPONS, STANCES & PASSIVE TOGGLES (2 COLS X rowCount ROWS) */}
        <div
          className={cn(
            'grid grid-cols-2 gap-1 transition-opacity',
            rowCount === 2 ? 'grid-rows-2' : rowCount === 3 ? 'grid-rows-3' : 'grid-rows-4',
            activeCategory !== 'ALL' && activeCategory !== 'PASSIVES'
              ? 'opacity-30'
              : 'opacity-100'
          )}
        >
          {/* 1. WEAPON SWAP: MELEE / RANGED */}
          <button
            type="button"
            onClick={() => {
              setRangedMode((prev) => !prev)
              toast.info('Weapon Set', !rangedMode ? 'Switched to Ranged loadout' : 'Switched to Melee loadout')
            }}
            title={rangedMode ? 'Loadout: Ranged weapon active (Click for Melee)' : 'Loadout: Melee weapon active (Click for Ranged)'}
            className={cn(
              'group relative flex h-9 w-9 items-center justify-center border font-ui text-[10px] font-bold transition-all cursor-pointer',
              rangedMode
                ? 'border-tint-sky-ink bg-tint-sky-ink/20 text-tint-sky-ink shadow-[0_0_10px_color-mix(in_srgb,var(--color-tint-sky-ink)_calc(30%*var(--glow)),transparent)]'
                : 'border-tint-red/70 bg-tint-red/15 text-tint-red-ink hover:border-tint-red-ink'
            )}
          >
            {rangedMode ? <Crosshair className="h-4 w-4" /> : <Swords className="h-4 w-4" />}
            <span className="absolute bottom-0.5 left-0.5 text-[7px] font-extrabold text-ink/80">WPN</span>
          </button>

          {/* 2. NON-LETHAL ATTACKS TOGGLE */}
          <button
            type="button"
            onClick={() => {
              setNonLethal((prev) => !prev)
              toast.info('Combat Stance', !nonLethal ? 'Non-lethal attacks enabled: hostiles will be knocked out' : 'Lethal attacks restored')
            }}
            title={nonLethal ? 'Non-Lethal: Active (Enemies knocked unconscious at 0 HP)' : 'Non-Lethal: Inactive (Normal damage kills)'}
            className={cn(
              'group relative flex h-9 w-9 items-center justify-center border font-ui text-[10px] font-bold transition-all cursor-pointer',
              nonLethal
                ? 'border-tint-green-ink bg-tint-green-ink/20 text-tint-green-ink shadow-[0_0_10px_color-mix(in_srgb,var(--color-ok)_calc(40%*var(--glow)),transparent)]'
                : 'border-line/40 tone-well-60 text-faint hover:border-ink'
            )}
          >
            <Heart className="h-4 w-4" />
            <span className="absolute bottom-0.5 left-0.5 text-[7px] font-extrabold text-ink/80">STN</span>
            <span className="absolute top-0.5 right-0.5 text-[6.5px]">{nonLethal ? 'ON' : 'OFF'}</span>
          </button>

          {/* 3. DUAL-WIELD OFFHAND TOGGLE */}
          <button
            type="button"
            onClick={() => {
              setDualWield((prev) => !prev)
              toast.info('Dual Wield', !dualWield ? 'Dual Wield: Offhand weapon primed' : 'Dual Wield: Single weapon focus')
            }}
            title={dualWield ? 'Dual Wield: Auto-strike with off-hand weapon' : 'Dual Wield: Off-hand striking disabled'}
            className={cn(
              'group relative flex h-9 w-9 items-center justify-center border font-ui text-[10px] font-bold transition-all cursor-pointer',
              dualWield
                ? 'border-accent bg-accent/20 text-accent shadow-[0_0_10px_color-mix(in_srgb,rgb(255,160,0)_calc(40%*var(--glow)),transparent)]'
                : 'border-line/40 tone-well-60 text-faint hover:border-ink'
            )}
          >
            <Layers className="h-4 w-4" />
            <span className="absolute bottom-0.5 left-0.5 text-[7px] font-extrabold text-ink/80 caps">Dual</span>
          </button>

          {/* 4. REACTION TOGGLE */}
          <button
            type="button"
            onClick={() => {
              setReactionEnabled((prev) => !prev)
              toast.info('Reaction Interlock', !reactionEnabled ? 'Reactions armed: Opportunity attacks will trigger' : 'Reactions held')
            }}
            title={reactionEnabled ? 'Reaction: Armed for opportunity attacks' : 'Reaction: Held (Will not trigger automatically)'}
            className={cn(
              'group relative flex h-9 w-9 items-center justify-center border font-ui text-[10px] font-bold transition-all cursor-pointer',
              reactionEnabled
                ? 'border-tint-purple/70 bg-tint-purple/20 text-tint-purple shadow-[0_0_10px_color-mix(in_srgb,rgb(180,100,255)_calc(30%*var(--glow)),transparent)]'
                : 'border-line/40 tone-well-60 text-faint hover:border-ink'
            )}
          >
            <Radio className="h-4 w-4" />
            <span className="absolute bottom-0.5 left-0.5 text-[7px] font-extrabold text-ink/80 caps">Reac</span>
          </button>

          {/* 5. DEFENSIVE GUARD (Shown if >= 3 rows) */}
          {rowCount >= 3 && (
            <button
              type="button"
              onClick={() => toast.info('Defensive Guard', 'Guard stance: +1 AC against melee attackers')}
              title="Guard Stance: Raise guard to parry incoming physical strikes"
              className="group relative flex h-9 w-9 items-center justify-center border border-line/40 tone-well-60 font-ui text-[10px] font-bold text-dim hover:border-tint-cyan hover:text-tint-cyan cursor-pointer transition-all"
            >
              <Shield className="h-4 w-4" />
              <span className="absolute bottom-0.5 left-0.5 text-[7px] font-extrabold text-ink/80">DEF</span>
            </button>
          )}

          {/* 6. OVERWATCH / INTERCEPT (Shown if >= 3 rows) */}
          {rowCount >= 3 && (
            <button
              type="button"
              onClick={() => toast.info('Overwatch', 'Overwatch: Reserve action to shoot moving enemies')}
              title="Overwatch: Hold action to attack the first hostile that enters line of sight"
              className="group relative flex h-9 w-9 items-center justify-center border border-line/40 tone-well-60 font-ui text-[10px] font-bold text-dim hover:border-tint-amber-ink hover:text-tint-amber-ink cursor-pointer transition-all"
            >
              <Crosshair className="h-4 w-4" />
              <span className="absolute bottom-0.5 left-0.5 text-[7px] font-extrabold text-ink/80">OVR</span>
            </button>
          )}

          {/* 7. COMBAT SPRINT (Shown if 4 rows) */}
          {rowCount === 4 && (
            <button
              type="button"
              onClick={() => toast.info('Sprint', 'Sprint stance: Max velocity')}
              title="Sprint: Tactical sprint stance"
              className="group relative flex h-9 w-9 items-center justify-center border border-line/40 tone-well-60 font-ui text-[10px] font-bold text-dim hover:border-ok hover:text-ok cursor-pointer transition-all"
            >
              <Footprints className="h-4 w-4" />
              <span className="absolute bottom-0.5 left-0.5 text-[7px] font-extrabold text-ink/80">SPR</span>
            </button>
          )}

          {/* 8. COMBAT RELOAD (Shown if 4 rows) */}
          {rowCount === 4 && (
            <button
              type="button"
              onClick={() => toast.info('Reload', 'Reload ranged magazines')}
              title="Reload: Tactical ammunition reload"
              className="group relative flex h-9 w-9 items-center justify-center border border-line/40 tone-well-60 font-ui text-[10px] font-bold text-dim hover:border-tint-sky-ink hover:text-tint-sky-ink cursor-pointer transition-all"
            >
              <Zap className="h-4 w-4" />
              <span className="absolute bottom-0.5 left-0.5 text-[7px] font-extrabold text-ink/80">RLD</span>
            </button>
          )}
        </div>

        {/* MCRN TERMINAL DIVIDER 4 (RED ACCENT GRIPPER) */}
        <div className="flex flex-col items-center justify-center px-0.5 cursor-col-resize select-none">
          <div className="h-full w-1 flex flex-col items-center justify-center gap-1 border-l border-r border-tint-red/30 bg-tint-red/5">
            <span className="h-1 w-0.5 bg-tint-red/60" />
            <span className="h-1 w-0.5 bg-tint-red/60" />
            <span className="h-1 w-0.5 bg-tint-red/60" />
          </div>
        </div>

        {/* PANEL 5: DECK CONTROLS & TURN SEQUENCER */}
        <div className="flex flex-col justify-between w-24 py-0.5">
          {/* TOP CONTROLS: LOCK & ROW MULTIPLIER (+ / -) */}
          <div className="flex items-center justify-between border-b border-line/50 pb-1">
            {/* LOCK TOGGLE BUTTON */}
            <button
              type="button"
              onClick={toggleLock}
              title={isLocked ? 'Deck Locked: Click to unlock and reorder slots' : 'Deck Unlocked: Click to lock against accidental dragging'}
              className={cn(
                'flex h-6 w-6 items-center justify-center border font-ui transition-all cursor-pointer',
                isLocked
                  ? 'border-line/60 tone-well-60 text-dim hover:border-ink hover:text-ink'
                  : 'border-accent bg-accent/20 text-accent shadow-[0_0_8px_color-mix(in_srgb,rgb(255,160,0)_calc(50%*var(--glow)),transparent)]'
              )}
            >
              {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            </button>

            {/* ROW COUNTER & MULTIPLIER */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => toggleRows(-1)}
                disabled={rowCount <= 2}
                title="Collapse row height"
                className="flex h-6 w-5 items-center justify-center border border-line/50 tone-well-60 text-dim hover:border-tint-cyan hover:text-tint-cyan disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <Minus className="h-2.5 w-2.5" />
              </button>
              <span className="px-1 text-[8.5px] font-bold text-ink">
                {rowCount}R
              </span>
              <button
                type="button"
                onClick={() => toggleRows(1)}
                disabled={rowCount >= 4}
                title="Expand row height"
                className="flex h-6 w-5 items-center justify-center border border-line/50 tone-well-60 text-dim hover:border-tint-cyan hover:text-tint-cyan disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <Plus className="h-2.5 w-2.5" />
              </button>
            </div>
          </div>

          {/* TURN STATUS DISPLAY */}
          <div className="flex flex-col gap-0.5 py-0.5">
            <span className="text-[7.5px] caps-5 text-faint">
              {inCombat ? 'TACTICAL TURN' : 'EXPLORATION'}
            </span>
            <span
              className={cn(
                'truncate text-[9px] font-bold',
                isPlayerTurn ? 'text-tint-cyan' : inCombat ? 'text-alert' : 'text-ink'
              )}
            >
              {isPlayerTurn
                ? 'YOUR TURN'
                : inCombat
                ? activeActor?.name ?? 'ACTING...'
                : 'FREE ROAM'}
            </span>
          </div>

          {/* COMPACT END TURN BUTTON */}
          <button
            type="button"
            onClick={endTurn}
            disabled={!inCombat || !isPlayerTurn}
            className={cn(
              'flex h-7 items-center justify-center gap-1 border px-2 text-[9px] font-bold caps-5 transition-all cursor-pointer',
              isPlayerTurn
                ? 'border-tint-cyan bg-tint-cyan text-on-accent hover:bg-tint-cyan/90 shadow-[0_0_12px_color-mix(in_srgb,rgb(0,216,246)_calc(50%*var(--glow)),transparent)]'
                : 'border-line/40 bg-line/20 text-faint cursor-not-allowed opacity-40'
            )}
          >
            <span>END TURN</span>
            <span className="text-[7.5px] opacity-75">[{endTurnDisplay}]</span>
          </button>
        </div>
      </div>

      {/* 3. FULL-WIDTH MOVEMENT GAUGE TRACK (RUNNING ACROSS THE ENTIRE DECK) */}
      <div
        className="relative h-1.5 w-full border-t border-b border-line/60 tone-panel-90 overflow-hidden"
        title={`Tactical Movement: ${speedRem}/${maxSpeed} FT remaining`}
      >
        <div
          className="h-full bg-tint-cyan shadow-[0_0_10px_color-mix(in_srgb,rgb(0,216,246)_calc(80%*var(--glow)),transparent)] transition-all duration-200"
          style={{ width: `${speedPercent}%` }}
        />
        {/* Discrete 5-foot tick marks across the gauge */}
        <div className="absolute inset-0 flex justify-between pointer-events-none opacity-30">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="h-full w-px bg-ink" />
          ))}
        </div>
      </div>

      {/* 4. BOTTOM FILTER TABS & DYNAMIC CLASS DRAWER */}
      <div className="flex h-5 items-center gap-1 border border-line/70 border-t-0 tone-well-95 px-2 text-[8.5px] font-bold text-dim">
        {(
          [
            { id: 'ALL', label: '[ALL]' },
            { id: 'COMMON', label: '[COMMON]' },
            { id: 'CLASS', label: `[${dynamicClassName}]` },
            { id: 'ITEMS', label: '[ITEMS]' },
            { id: 'PASSIVES', label: '[PASSIVES]' },
            { id: 'META', label: '[META]' }
          ] as { id: DeckCategory; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveCategory(tab.id)}
            className={cn(
              'px-1.5 py-0.2 caps transition-colors cursor-pointer',
              activeCategory === tab.id
                ? 'bg-tint-cyan text-on-accent font-extrabold shadow-[0_0_8px_color-mix(in_srgb,rgb(0,216,246)_calc(50%*var(--glow)),transparent)]'
                : 'hover:text-ink text-faint'
            )}
          >
            {tab.label}
          </button>
        ))}
        <span className="ml-auto text-[8px] text-faint font-ui">
          MCRN TACTICAL CONSOLE
        </span>
      </div>
    </div>
  )
}
