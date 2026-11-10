import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import {
  Flame,
  Droplets,
  Zap,
  Shield,
  Heart,
  Skull,
  Sparkles,
  Swords,
  FlaskConical,
  Scroll,
  Footprints,
  MessageSquarePlus,
  HandHelping,
  ShieldAlert,
  Lock,
  Unlock,
  Plus,
  Minus,
  Crosshair,
  EyeOff,
  Radio,
  Layers
} from 'lucide-react'
import { Equipment, Inventory, Item, usableAbilities, type Ability } from '@shared/game/components'
import { GameEntity, type Catalog } from '@shared/game/core'
import type { PlaceVisitor } from '@shared/maps'
import { useGameState } from '../state/gameStateStore'
import { useDialogue } from '../dialogue/dialogueStore'
import { defaultDialogueTree, combatParleyDialogueTree } from '@shared/game/dialogue'
import { useGameplaySettings } from '../settings/gameplaySettingsStore'
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

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
const name = (a: Ability) => String(a.params.label || a.id)

function getSlotTheme(rawName: string) {
  const n = rawName.toLowerCase()
  if (n.includes('fire') || n.includes('flame') || n.includes('burn') || n.includes('pyro')) {
    return { Icon: Flame, color: 'text-amber-400', border: 'border-amber-500/70', bg: 'bg-amber-500/15' }
  }
  if (n.includes('cold') || n.includes('ice') || n.includes('frost') || n.includes('water')) {
    return { Icon: Droplets, color: 'text-sky-400', border: 'border-sky-500/70', bg: 'bg-sky-500/15' }
  }
  if (n.includes('light') || n.includes('shock') || n.includes('thunder') || n.includes('zap') || n.includes('spark')) {
    return { Icon: Zap, color: 'text-yellow-400', border: 'border-yellow-500/70', bg: 'bg-yellow-500/15' }
  }
  if (n.includes('shield') || n.includes('ward') || n.includes('armor') || n.includes('protect') || n.includes('guard')) {
    return { Icon: Shield, color: 'text-cyan', border: 'border-cyan/70', bg: 'bg-cyan/15' }
  }
  if (n.includes('heal') || n.includes('cure') || n.includes('restor') || n.includes('life')) {
    return { Icon: Heart, color: 'text-emerald-400', border: 'border-emerald-500/70', bg: 'bg-emerald-500/15' }
  }
  if (n.includes('potion') || n.includes('draught') || n.includes('elixir') || n.includes('flask')) {
    return { Icon: FlaskConical, color: 'text-emerald-400', border: 'border-emerald-500/70', bg: 'bg-emerald-500/15' }
  }
  if (n.includes('scroll') || n.includes('tome') || n.includes('parchment') || n.includes('book')) {
    return { Icon: Scroll, color: 'text-purple', border: 'border-purple/70', bg: 'bg-purple/15' }
  }
  if (n.includes('necro') || n.includes('death') || n.includes('decay') || n.includes('curse') || n.includes('dark')) {
    return { Icon: Skull, color: 'text-purple', border: 'border-purple/70', bg: 'bg-purple/15' }
  }
  if (n.includes('sword') || n.includes('slash') || n.includes('strike') || n.includes('dagger') || n.includes('weapon')) {
    return { Icon: Swords, color: 'text-red-400', border: 'border-red-500/70', bg: 'bg-red-500/15' }
  }
  return { Icon: Sparkles, color: 'text-cyan', border: 'border-cyan/70', bg: 'bg-cyan/15' }
}

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
    try {
      const saved = localStorage.getItem('seven:action_deck:rows')
      if (saved === '2' || saved === '3' || saved === '4') return Number(saved) as 2 | 3 | 4
    } catch {}
    return 3
  })

  // Action bar lock state (prevents accidental drags when locked)
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('seven:action_deck:locked') === 'true'
    } catch {
      return true
    }
  })

  // Combat stances / toggles
  const [nonLethal, setNonLethal] = useState(false)
  const [dualWield, setDualWield] = useState(false)
  const [rangedMode, setRangedMode] = useState(false)
  const [reactionEnabled, setReactionEnabled] = useState(true)

  const toggleRows = (delta: number) => {
    const next = Math.max(2, Math.min(4, rowCount + delta)) as 2 | 3 | 4
    setRowCount(next)
    try {
      localStorage.setItem('seven:action_deck:rows', String(next))
    } catch {}
  }

  const toggleLock = () => {
    setIsLocked((prev) => {
      const next = !prev
      try {
        localStorage.setItem('seven:action_deck:locked', String(next))
      } catch {}
      toast.info('Action Deck', next ? 'Deck locked: slot dragging disabled' : 'Deck unlocked: drag to reorder')
      return next
    })
  }

  const battle = useGameState((s) => s.battle)
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
    movementRemaining: 30,
    isDodging: false
  }

  // Target combatant
  const targetCombatant = inCombat && selectedTargetId
    ? battle?.queue.find((c) => c.id === selectedTargetId) ?? null
    : null

  // Game act for slottable actions & items
  const sheet = visitor?.sheet ?? ''
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

  const allItems = useMemo(() => {
    if (!entity) return []
    return [
      ...(entity.comp(Inventory)?.items ?? []),
      ...(entity.comp(Equipment)?.comps.filter((c): c is Item => c instanceof Item) ?? [])
    ]
  }, [entity])

  // Derive class label dynamically from sheet line (e.g. "Cleric", "Wizard", "Rogue")
  const dynamicClassName = useMemo(() => {
    if (visitor?.line) {
      const raw = visitor.line.split(',')[0] ?? ''
      const words = raw.split(' ')
      const knownClasses = [
        'Cleric', 'Wizard', 'Fighter', 'Rogue', 'Paladin', 'Ranger',
        'Warlock', 'Sorcerer', 'Druid', 'Monk', 'Bard', 'Barbarian',
        'Netrunner', 'Solo', 'Techie', 'Fixer', 'Merc'
      ]
      const found = words.find((w) => knownClasses.some((c) => c.toLowerCase() === w.toLowerCase()))
      if (found) return found.toUpperCase()
    }
    return 'CLASS'
  }, [visitor?.line])

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

  const useSlot = (slot: ActionSlotDef | null) => {
    if (!slot) return
    if (inCombat && economy.actionUsed) {
      toast.info('Action Economy', 'Standard action already expended this turn')
      return
    }

    if (slot.kind === 'ability') {
      const a = abilities.find((x) => x.uid === slot.uid || x.id === slot.id)
      if (a && a.reach() > 0) return onAim(aiming === a.uid ? null : { uid: a.uid, label: name(a) })
      if (!act) return
      act((e) => {
        const found = usableAbilities(e).find((x) => x.uid === slot.uid || x.id === slot.id)
        return found ? found.use({ user: e, target: e, at: null, distance: 0 }) : 'it is gone'
      })
    } else if (slot.kind === 'item') {
      if (!act) return
      act((e) => {
        const bag = e.comp(Inventory)?.items ?? []
        const worn = e.comp(Equipment)?.comps.filter((c): c is Item => c instanceof Item) ?? []
        const all = [...bag, ...worn]
        const found = all.find((i) => i.uid === slot.uid || i.id === slot.id)
        if (!found) return 'item not found'
        if (!found.usable()) return 'item cannot be used'
        return found.use({ user: e, target: e, at: null, distance: 0 })
      })
    }
  }

  // Maneuver triggers
  const executeStrike = () => {
    if (!inCombat || !targetCombatant) {
      toast.info('Targeting', 'Select a hostile target on map or right panel first')
      return
    }
    if (economy.actionUsed) {
      toast.info('Action Economy', 'Action already expended this turn')
      return
    }
    if (onAttack) onAttack(targetCombatant.id, rangedMode ? 'Ranged Shot' : 'Strike')
  }

  const executeDash = () => {
    if (inCombat) {
      if (economy.actionUsed) {
        toast.info('Action Economy', 'Action already expended')
        return
      }
      dashAction()
    } else {
      toast.info('Maneuver', 'Dash: Sprint speed engaged (+30 FT)')
    }
  }

  const executeDodge = () => {
    if (inCombat) {
      if (economy.actionUsed || economy.isDodging) return
      dodgeAction()
    } else {
      toast.info('Maneuver', 'Dodge: Defensive stance activated')
    }
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
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return
      const k = e.key.toLowerCase()

      if (k === '1' || k === 'f') {
        if (latestRef.current.inCombat && latestRef.current.isPlayerTurn && latestRef.current.targetCombatant) {
          e.preventDefault()
          latestRef.current.executeStrike()
        }
      } else if (k === '2' || k === 'c') {
        if (latestRef.current.inCombat && latestRef.current.isPlayerTurn) {
          e.preventDefault()
          latestRef.current.executeDash()
        }
      } else if (k === '3' || k === 'z') {
        if (latestRef.current.inCombat && latestRef.current.isPlayerTurn) {
          e.preventDefault()
          latestRef.current.executeDodge()
        }
      } else if (k === '4' || k === 'x') {
        if (latestRef.current.inCombat && latestRef.current.isPlayerTurn) {
          e.preventDefault()
          toast.info('Maneuver', 'Disengage: Movement prevents opportunity attacks')
        }
      } else if (k === 'p') {
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
      } catch {}
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
      } catch {}
    }
  }

  const maxSpeed = activeActor?.speedMax ?? 30
  const speedRem = inCombat ? economy.movementRemaining : maxSpeed
  const speedPercent = Math.max(0, Math.min(100, (speedRem / Math.max(1, maxSpeed)) * 100))

  return (
    <div
      className={cn(
        'pointer-events-auto absolute bottom-2 left-1/2 -translate-x-1/2 z-40 flex flex-col font-mono select-none shadow-[0_24px_60px_rgba(0,0,0,0.98)] backdrop-blur-md',
        className
      )}
    >
      {/* 1. TOP SHELF: RESOURCE TELEMETRY, SPELL MATRIX & ACTIVE BUFF DOCK */}
      <div className="flex h-7 items-center justify-between border border-line/70 border-b-0 bg-black/95 px-2.5 text-[10px]">
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
            <span className={cn('h-2.5 w-2.5 rounded-none', !economy.actionUsed ? 'bg-ok shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'border border-line/40 bg-black/60')} />
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
            <span className={cn('h-2.5 w-2.5 rounded-none rotate-45', !economy.bonusActionUsed ? 'bg-accent shadow-[0_0_8px_rgba(255,160,0,0.8)]' : 'border border-line/40 bg-black/60')} />
            <span>BONUS</span>
          </div>

          {/* REACTION PIP */}
          <div
            className={cn(
              'flex items-center gap-1 font-bold',
              reactionEnabled && !economy.reactionUsed ? 'text-purple' : 'text-faint line-through opacity-40'
            )}
            title="Reaction: Opportunity attacks, shield counters, and ripostes"
          >
            <span className={cn('h-2.5 w-2.5 rounded-none', reactionEnabled && !economy.reactionUsed ? 'bg-purple shadow-[0_0_8px_rgba(180,100,255,0.8)]' : 'border border-line/40 bg-black/60')} />
            <span>REACT</span>
          </div>

          {/* CLASS CHARGES / ENERGY COUNTER */}
          <div
            className="flex items-center gap-1 border-l border-line/50 pl-2.5 text-amber-400 font-bold"
            title="Class Charges / Tactical Power / Focus"
          >
            <Flame className="h-3 w-3" />
            <span className="text-[11px] font-extrabold tracking-tight">8</span>
            <span className="text-[8px] text-amber-500/80">FOCUS</span>
          </div>
        </div>

        {/* CENTER: ROMAN NUMERAL SPELL SLOT MATRIX */}
        <div className="flex items-center gap-2.5 text-[9px] text-dim">
          <div className="flex items-center gap-0.5">
            <span className="text-cyan font-bold mr-0.5">I</span>
            <span className="flex gap-0.5">
              <span className="h-2 w-2 border border-cyan/60 bg-cyan shadow-[0_0_6px_rgba(0,216,246,0.6)]" />
              <span className="h-2 w-2 border border-cyan/60 bg-cyan shadow-[0_0_6px_rgba(0,216,246,0.6)]" />
              <span className="h-2 w-2 border border-cyan/60 bg-cyan shadow-[0_0_6px_rgba(0,216,246,0.6)]" />
              <span className="h-2 w-2 border border-cyan/60 bg-cyan shadow-[0_0_6px_rgba(0,216,246,0.6)]" />
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <span className="text-cyan font-bold mr-0.5">II</span>
            <span className="flex gap-0.5">
              <span className="h-2 w-2 border border-cyan/60 bg-cyan shadow-[0_0_6px_rgba(0,216,246,0.6)]" />
              <span className="h-2 w-2 border border-cyan/60 bg-cyan shadow-[0_0_6px_rgba(0,216,246,0.6)]" />
              <span className="h-2 w-2 border border-cyan/60 bg-cyan shadow-[0_0_6px_rgba(0,216,246,0.6)]" />
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <span className="text-cyan font-bold mr-0.5">III</span>
            <span className="flex gap-0.5">
              <span className="h-2 w-2 border border-cyan/60 bg-cyan shadow-[0_0_6px_rgba(0,216,246,0.6)]" />
              <span className="h-2 w-2 border border-cyan/60 bg-cyan shadow-[0_0_6px_rgba(0,216,246,0.6)]" />
            </span>
          </div>
          <div className="flex items-center gap-0.5 text-faint">
            <span className="font-bold mr-0.5">IV</span>
            <span className="flex gap-0.5">
              <span className="h-2 w-2 border border-line/40 bg-black/40" />
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
            <span className="text-[8px] uppercase tracking-wider text-faint">
              STABLE CONCENTRATION
            </span>
          )}

          <div className="flex items-center gap-1 border-l border-line/50 pl-2 text-cyan">
            <Footprints className="h-3 w-3" />
            <strong className={speedRem > 0 ? 'text-cyan font-extrabold' : 'text-faint'}>
              {speedRem}/{maxSpeed} FT
            </strong>
          </div>
        </div>
      </div>

      {/* 2. MAIN MODULAR ACTION DECK (DYNAMIC ROWS: 2, 3, or 4) */}
      <div className="flex border border-line/70 bg-black/95 p-1 gap-1">
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
          <button
            type="button"
            onClick={executeStrike}
            disabled={inCombat && (!isPlayerTurn || economy.actionUsed || !targetCombatant)}
            title={
              targetCombatant
                ? `Strike ${targetCombatant.name} with weapon (Action · [1/F])`
                : 'Strike: Select a target entity first (Action · [1/F])'
            }
            className={cn(
              'group relative flex h-9 w-9 items-center justify-center border font-mono text-[10px] font-bold transition-all',
              targetCombatant && (!inCombat || (isPlayerTurn && !economy.actionUsed))
                ? 'border-red-500/70 bg-red-500/15 text-red-400 hover:border-red-400 hover:scale-105 cursor-pointer shadow-[0_0_10px_rgba(239,68,68,0.25)]'
                : 'border-line/40 bg-black/60 text-faint cursor-not-allowed'
            )}
          >
            <Swords className="h-4 w-4" />
            <span className="absolute bottom-0.5 left-0.5 text-[7.5px] font-extrabold text-white/80">1</span>
            <span className="absolute top-0.5 right-0.5 text-[7px] text-red-400">ACT</span>
          </button>

          {/* 2. DASH */}
          <button
            type="button"
            onClick={executeDash}
            disabled={inCombat && (!isPlayerTurn || economy.actionUsed)}
            title="Dash: Doubles movement speed for this turn (Action · [2/C])"
            className={cn(
              'group relative flex h-9 w-9 items-center justify-center border font-mono text-[10px] font-bold transition-all',
              !inCombat || (isPlayerTurn && !economy.actionUsed)
                ? 'border-line/60 bg-black/60 text-white hover:border-cyan hover:text-cyan hover:scale-105 cursor-pointer'
                : 'border-line/30 bg-black/40 text-faint cursor-not-allowed'
            )}
          >
            <Footprints className="h-4 w-4 text-cyan" />
            <span className="absolute bottom-0.5 left-0.5 text-[7.5px] font-extrabold text-white/80">C</span>
            <span className="absolute top-0.5 right-0.5 text-[7px] text-cyan">ACT</span>
          </button>

          {/* 3. DODGE */}
          <button
            type="button"
            onClick={executeDodge}
            disabled={inCombat && (!isPlayerTurn || economy.actionUsed || economy.isDodging)}
            title="Dodge: Attackers suffer disadvantage against you (Action · [3/Z])"
            className={cn(
              'group relative flex h-9 w-9 items-center justify-center border font-mono text-[10px] font-bold transition-all',
              economy.isDodging
                ? 'border-accent bg-accent/20 text-accent cursor-default'
                : !inCombat || (isPlayerTurn && !economy.actionUsed)
                ? 'border-line/60 bg-black/60 text-white hover:border-accent hover:text-accent hover:scale-105 cursor-pointer'
                : 'border-line/30 bg-black/40 text-faint cursor-not-allowed'
            )}
          >
            <Shield className="h-4 w-4 text-accent" />
            <span className="absolute bottom-0.5 left-0.5 text-[7.5px] font-extrabold text-white/80">Z</span>
            <span className="absolute top-0.5 right-0.5 text-[7px] text-accent">ACT</span>
          </button>

          {/* 4. DISENGAGE */}
          <button
            type="button"
            onClick={() => {
              if (inCombat) {
                if (economy.actionUsed) return
                toast.info('Maneuver', 'Disengage: Movement prevents attacks of opportunity')
              }
            }}
            disabled={inCombat && (!isPlayerTurn || economy.actionUsed)}
            title="Disengage: Movement does not provoke opportunity attacks (Action · [4/X])"
            className={cn(
              'group relative flex h-9 w-9 items-center justify-center border font-mono text-[10px] font-bold transition-all',
              !inCombat || (isPlayerTurn && !economy.actionUsed)
                ? 'border-line/60 bg-black/60 text-white hover:border-white hover:scale-105 cursor-pointer'
                : 'border-line/30 bg-black/40 text-faint cursor-not-allowed'
            )}
          >
            <ShieldAlert className="h-4 w-4 text-dim" />
            <span className="absolute bottom-0.5 left-0.5 text-[7.5px] font-extrabold text-white/80">X</span>
            <span className="absolute top-0.5 right-0.5 text-[7px] text-dim">ACT</span>
          </button>

          {/* 5. HELP (Shown if >= 3 rows) */}
          {rowCount >= 3 && (
            <button
              type="button"
              onClick={() => toast.info('Help', 'Aid an allied companion')}
              title="Help: Grant advantage on an ally next ability or attack ([5/V])"
              className="group relative flex h-9 w-9 items-center justify-center border border-line/60 bg-black/60 font-mono text-[10px] font-bold text-white hover:border-ok hover:text-ok hover:scale-105 cursor-pointer transition-all"
            >
              <HandHelping className="h-4 w-4 text-ok" />
              <span className="absolute bottom-0.5 left-0.5 text-[7.5px] font-extrabold text-white/80">V</span>
              <span className="absolute top-0.5 right-0.5 text-[7px] text-ok">ACT</span>
            </button>
          )}

          {/* 6. PARLEY (META DIALOGUE - Shown if >= 3 rows) */}
          {rowCount >= 3 && (
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
                'group relative flex h-9 w-9 items-center justify-center border font-mono text-[10px] font-bold transition-all',
                targetCombatant
                  ? 'border-purple/70 bg-purple/15 text-purple hover:border-purple hover:bg-purple hover:text-black hover:scale-105 cursor-pointer shadow-[0_0_10px_rgba(180,100,255,0.3)]'
                  : 'border-line/30 bg-black/40 text-faint cursor-not-allowed'
              )}
            >
              <MessageSquarePlus className="h-4 w-4 text-purple" />
              <span className="absolute bottom-0.5 left-0.5 text-[7.5px] font-extrabold text-purple">P</span>
              <span className="absolute top-0.5 right-0.5 text-[7px] text-purple">META</span>
            </button>
          )}

          {/* 7. HIDE / STEALTH (Shown if 4 rows) */}
          {rowCount === 4 && (
            <button
              type="button"
              onClick={() => toast.info('Stealth', 'Hide: Attempt stealth check against enemy passive perception')}
              title="Hide: Conceal yourself to gain advantage on unseen strikes"
              className="group relative flex h-9 w-9 items-center justify-center border border-line/60 bg-black/60 font-mono text-[10px] font-bold text-white hover:border-sky-400 hover:text-sky-400 hover:scale-105 cursor-pointer transition-all"
            >
              <EyeOff className="h-4 w-4 text-sky-400" />
              <span className="absolute bottom-0.5 left-0.5 text-[7.5px] font-extrabold text-white/80">H</span>
              <span className="absolute top-0.5 right-0.5 text-[7px] text-sky-400">ACT</span>
            </button>
          )}

          {/* 8. SHOVE (Shown if 4 rows) */}
          {rowCount === 4 && (
            <button
              type="button"
              onClick={() => toast.info('Shove', 'Shove: Push enemy back 5 FT or knock prone (Athletics check)')}
              title="Shove: Physical contest to push target or knock prone (Bonus Action)"
              className="group relative flex h-9 w-9 items-center justify-center border border-line/60 bg-black/60 font-mono text-[10px] font-bold text-white hover:border-amber-400 hover:text-amber-400 hover:scale-105 cursor-pointer transition-all"
            >
              <Crosshair className="h-4 w-4 text-amber-400" />
              <span className="absolute bottom-0.5 left-0.5 text-[7.5px] font-extrabold text-white/80">S</span>
              <span className="absolute top-0.5 right-0.5 text-[7px] text-amber-400">BON</span>
            </button>
          )}
        </div>

        {/* MCRN TERMINAL DIVIDER 1 (RED ACCENT GRIPPER) */}
        <div className="flex flex-col items-center justify-center px-0.5 cursor-col-resize select-none">
          <div className="h-full w-1 flex flex-col items-center justify-center gap-1 border-l border-r border-red-500/30 bg-red-950/20">
            <span className="h-1 w-0.5 bg-red-500/60" />
            <span className="h-1 w-0.5 bg-red-500/60" />
            <span className="h-1 w-0.5 bg-red-500/60" />
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
                    'relative flex h-9 w-9 select-none items-center justify-center border font-mono transition-all',
                    isOver
                      ? 'border-cyan bg-cyan/25 scale-105 shadow-[0_0_12px_rgba(0,216,246,0.5)]'
                      : 'border-line/40 bg-black/60 hover:border-line'
                  )}
                  title={`Class Slot ${i + 1} (${isLocked ? 'Locked' : 'Empty · Drag ability here'})`}
                >
                  <span className="text-[10px] text-line-bright/20 font-mono">+</span>
                </div>
              )
            }

            if (slot.kind === 'ability') {
              const a = abilities.find((x) => x.uid === slot.uid || x.id === slot.id)
              const ready = a && entity ? a.canUse({ user: entity, target: entity, at: null, distance: 0 }) : 'unavailable'
              const cooling = a ? a.cooling > 0 : false
              const rows = a && catalog
                ? [
                    ...Object.entries(a.cost).map(([s, n]) => ({ label: catalog.stat(s)?.label ?? s, value: String(n) })),
                    ...a.comps.flatMap((c) => c.tooltipRows())
                  ]
                : []
              const body = (
                <span className="flex min-w-44 flex-col gap-1.5">
                  {a?.item && (
                    <span className="font-mono text-[10px] text-purple">
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
              const theme = getSlotTheme(label)
              const Icon = theme.Icon
              const isUpcastable = Boolean(a && Object.keys(a.cost).length > 0)

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
                    'group relative flex h-9 w-9 items-center justify-center border font-mono text-[10px] font-bold transition-all',
                    isLocked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
                    isOver && 'border-cyan bg-cyan/25 scale-105 shadow-[0_0_12px_rgba(0,216,246,0.6)]',
                    ready === true
                      ? cn(theme.border, theme.bg, theme.color, 'hover:scale-105 hover:border-cyan')
                      : 'border-line/40 bg-black/60 text-faint opacity-50',
                    aiming && a && aiming === a.uid && 'border-cyan bg-cyan/30 text-cyan shadow-[0_0_14px_rgba(0,216,246,0.8)] animate-pulse'
                  )}
                >
                  <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
                  
                  {/* UPCAST / TIER INDICATOR BADGE (+) */}
                  {isUpcastable && (
                    <span
                      className="absolute top-0.5 right-0.5 text-[8px] font-extrabold text-cyan/90 leading-none"
                      title="Tier / Variable Upcast"
                    >
                      +
                    </span>
                  )}

                  {cooling && a && (
                    <span className="absolute inset-x-0 bottom-0 bg-black/90 text-center text-[8px] font-bold text-dim">
                      {gameTime(a.cooling)}
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
          <div className="h-full w-1 flex flex-col items-center justify-center gap-1 border-l border-r border-red-500/30 bg-red-950/20">
            <span className="h-1 w-0.5 bg-red-500/60" />
            <span className="h-1 w-0.5 bg-red-500/60" />
            <span className="h-1 w-0.5 bg-red-500/60" />
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
                    'relative flex h-9 w-9 select-none items-center justify-center border font-mono transition-all',
                    isOver
                      ? 'border-cyan bg-cyan/25 scale-105 shadow-[0_0_12px_rgba(0,216,246,0.5)]'
                      : 'border-line/40 bg-black/60 hover:border-line'
                  )}
                  title={`Item Slot ${i + 1} (${isLocked ? 'Locked' : 'Empty · Drag item here'})`}
                >
                  <span className="text-[10px] text-line-bright/20 font-mono">+</span>
                </div>
              )
            }

            const item = allItems.find((x) => x.uid === slot.uid || x.id === slot.id)
            const tip = item ? itemTip(item) : null
            const itemLabel = item ? itemName(item) : slot.label
            const count = item?.count ?? 0
            const theme = getSlotTheme(itemLabel)
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
                  'group relative flex h-9 w-9 items-center justify-center border font-mono text-[10px] font-bold transition-all',
                  isLocked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
                  isOver && 'border-cyan bg-cyan/25 scale-105 shadow-[0_0_12px_rgba(0,216,246,0.6)]',
                  item && item.usable()
                    ? cn(theme.border, theme.bg, theme.color, 'hover:scale-105 hover:border-cyan')
                    : 'border-line/40 bg-black/60 text-faint'
                )}
              >
                <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
                {count > 1 && (
                  <span className="absolute right-0.5 bottom-0.5 border border-accent/40 bg-black/90 px-0.5 text-[7.5px] font-bold text-accent">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* MCRN TERMINAL DIVIDER 3 (RED ACCENT GRIPPER) */}
        <div className="flex flex-col items-center justify-center px-0.5 cursor-col-resize select-none">
          <div className="h-full w-1 flex flex-col items-center justify-center gap-1 border-l border-r border-red-500/30 bg-red-950/20">
            <span className="h-1 w-0.5 bg-red-500/60" />
            <span className="h-1 w-0.5 bg-red-500/60" />
            <span className="h-1 w-0.5 bg-red-500/60" />
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
              'group relative flex h-9 w-9 items-center justify-center border font-mono text-[10px] font-bold transition-all cursor-pointer',
              rangedMode
                ? 'border-sky-400 bg-sky-400/20 text-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.3)]'
                : 'border-red-500/70 bg-red-500/15 text-red-400 hover:border-red-400'
            )}
          >
            {rangedMode ? <Crosshair className="h-4 w-4" /> : <Swords className="h-4 w-4" />}
            <span className="absolute bottom-0.5 left-0.5 text-[7px] font-extrabold text-white/80">WPN</span>
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
              'group relative flex h-9 w-9 items-center justify-center border font-mono text-[10px] font-bold transition-all cursor-pointer',
              nonLethal
                ? 'border-emerald-400 bg-emerald-400/20 text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.4)]'
                : 'border-line/40 bg-black/60 text-faint hover:border-white'
            )}
          >
            <Heart className="h-4 w-4" />
            <span className="absolute bottom-0.5 left-0.5 text-[7px] font-extrabold text-white/80">STN</span>
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
              'group relative flex h-9 w-9 items-center justify-center border font-mono text-[10px] font-bold transition-all cursor-pointer',
              dualWield
                ? 'border-accent bg-accent/20 text-accent shadow-[0_0_10px_rgba(255,160,0,0.4)]'
                : 'border-line/40 bg-black/60 text-faint hover:border-white'
            )}
          >
            <Layers className="h-4 w-4" />
            <span className="absolute bottom-0.5 left-0.5 text-[7px] font-extrabold text-white/80">DUAL</span>
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
              'group relative flex h-9 w-9 items-center justify-center border font-mono text-[10px] font-bold transition-all cursor-pointer',
              reactionEnabled
                ? 'border-purple/70 bg-purple/20 text-purple shadow-[0_0_10px_rgba(180,100,255,0.3)]'
                : 'border-line/40 bg-black/60 text-faint hover:border-white'
            )}
          >
            <Radio className="h-4 w-4" />
            <span className="absolute bottom-0.5 left-0.5 text-[7px] font-extrabold text-white/80">REAC</span>
          </button>

          {/* 5. DEFENSIVE GUARD (Shown if >= 3 rows) */}
          {rowCount >= 3 && (
            <button
              type="button"
              onClick={() => toast.info('Defensive Guard', 'Guard stance: +1 AC against melee attackers')}
              title="Guard Stance: Raise guard to parry incoming physical strikes"
              className="group relative flex h-9 w-9 items-center justify-center border border-line/40 bg-black/60 font-mono text-[10px] font-bold text-dim hover:border-cyan hover:text-cyan cursor-pointer transition-all"
            >
              <Shield className="h-4 w-4" />
              <span className="absolute bottom-0.5 left-0.5 text-[7px] font-extrabold text-white/80">DEF</span>
            </button>
          )}

          {/* 6. OVERWATCH / INTERCEPT (Shown if >= 3 rows) */}
          {rowCount >= 3 && (
            <button
              type="button"
              onClick={() => toast.info('Overwatch', 'Overwatch: Reserve action to shoot moving enemies')}
              title="Overwatch: Hold action to attack the first hostile that enters line of sight"
              className="group relative flex h-9 w-9 items-center justify-center border border-line/40 bg-black/60 font-mono text-[10px] font-bold text-dim hover:border-amber-400 hover:text-amber-400 cursor-pointer transition-all"
            >
              <Crosshair className="h-4 w-4" />
              <span className="absolute bottom-0.5 left-0.5 text-[7px] font-extrabold text-white/80">OVR</span>
            </button>
          )}

          {/* 7. COMBAT SPRINT (Shown if 4 rows) */}
          {rowCount === 4 && (
            <button
              type="button"
              onClick={() => toast.info('Sprint', 'Sprint stance: Max velocity')}
              title="Sprint: Tactical sprint stance"
              className="group relative flex h-9 w-9 items-center justify-center border border-line/40 bg-black/60 font-mono text-[10px] font-bold text-dim hover:border-ok hover:text-ok cursor-pointer transition-all"
            >
              <Footprints className="h-4 w-4" />
              <span className="absolute bottom-0.5 left-0.5 text-[7px] font-extrabold text-white/80">SPR</span>
            </button>
          )}

          {/* 8. COMBAT RELOAD (Shown if 4 rows) */}
          {rowCount === 4 && (
            <button
              type="button"
              onClick={() => toast.info('Reload', 'Reload ranged magazines')}
              title="Reload: Tactical ammunition reload"
              className="group relative flex h-9 w-9 items-center justify-center border border-line/40 bg-black/60 font-mono text-[10px] font-bold text-dim hover:border-sky-400 hover:text-sky-400 cursor-pointer transition-all"
            >
              <Zap className="h-4 w-4" />
              <span className="absolute bottom-0.5 left-0.5 text-[7px] font-extrabold text-white/80">RLD</span>
            </button>
          )}
        </div>

        {/* MCRN TERMINAL DIVIDER 4 (RED ACCENT GRIPPER) */}
        <div className="flex flex-col items-center justify-center px-0.5 cursor-col-resize select-none">
          <div className="h-full w-1 flex flex-col items-center justify-center gap-1 border-l border-r border-red-500/30 bg-red-950/20">
            <span className="h-1 w-0.5 bg-red-500/60" />
            <span className="h-1 w-0.5 bg-red-500/60" />
            <span className="h-1 w-0.5 bg-red-500/60" />
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
                'flex h-6 w-6 items-center justify-center border font-mono transition-all cursor-pointer',
                isLocked
                  ? 'border-line/60 bg-black/60 text-dim hover:border-white hover:text-white'
                  : 'border-accent bg-accent/20 text-accent shadow-[0_0_8px_rgba(255,160,0,0.5)]'
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
                className="flex h-6 w-5 items-center justify-center border border-line/50 bg-black/60 text-dim hover:border-cyan hover:text-cyan disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <Minus className="h-2.5 w-2.5" />
              </button>
              <span className="px-1 text-[8.5px] font-bold text-white">
                {rowCount}R
              </span>
              <button
                type="button"
                onClick={() => toggleRows(1)}
                disabled={rowCount >= 4}
                title="Expand row height"
                className="flex h-6 w-5 items-center justify-center border border-line/50 bg-black/60 text-dim hover:border-cyan hover:text-cyan disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <Plus className="h-2.5 w-2.5" />
              </button>
            </div>
          </div>

          {/* TURN STATUS DISPLAY */}
          <div className="flex flex-col gap-0.5 py-0.5">
            <span className="text-[7.5px] uppercase tracking-wider text-faint">
              {inCombat ? 'TACTICAL TURN' : 'EXPLORATION'}
            </span>
            <span
              className={cn(
                'truncate text-[9px] font-bold',
                isPlayerTurn ? 'text-cyan' : inCombat ? 'text-alert' : 'text-white'
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
              'flex h-7 items-center justify-center gap-1 border px-2 text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer',
              isPlayerTurn
                ? 'border-cyan bg-cyan text-black hover:bg-cyan/90 shadow-[0_0_12px_rgba(0,216,246,0.5)]'
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
        className="relative h-1.5 w-full border-t border-b border-line/60 bg-black/90 overflow-hidden"
        title={`Tactical Movement: ${speedRem}/${maxSpeed} FT remaining`}
      >
        <div
          className="h-full bg-cyan shadow-[0_0_10px_rgba(0,216,246,0.8)] transition-all duration-200"
          style={{ width: `${speedPercent}%` }}
        />
        {/* Discrete 5-foot tick marks across the gauge */}
        <div className="absolute inset-0 flex justify-between pointer-events-none opacity-30">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="h-full w-px bg-white" />
          ))}
        </div>
      </div>

      {/* 4. BOTTOM FILTER TABS & DYNAMIC CLASS DRAWER */}
      <div className="flex h-5 items-center gap-1 border border-line/70 border-t-0 bg-black/95 px-2 text-[8.5px] font-bold text-dim">
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
              'px-1.5 py-0.2 uppercase transition-colors cursor-pointer',
              activeCategory === tab.id
                ? 'bg-cyan text-black font-extrabold shadow-[0_0_8px_rgba(0,216,246,0.5)]'
                : 'hover:text-white text-faint'
            )}
          >
            {tab.label}
          </button>
        ))}
        <span className="ml-auto text-[8px] text-faint font-mono">
          MCRN TACTICAL CONSOLE
        </span>
      </div>
    </div>
  )
}
