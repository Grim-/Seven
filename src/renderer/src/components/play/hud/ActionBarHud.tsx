import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Classes, Equipment, Inventory, Item, usableAbilities, type Ability } from '@shared/game/components'
import { GameEntity, type Catalog } from '@shared/game/core'
import type { PlaceVisitor } from '@shared/maps'
import { cn } from '../../../lib/cn'
import { useLatest } from '../../../game/react/useLatest'
import { hideTip, showTip } from '../../ui/TooltipHost'
import { openMenu } from '../../ui'
import { RowList } from '../../../game/ui'
import { canSpendTurnCost, runAbilityUse, runItemUse, slotThemeFor } from '../state/combatGate'
import { useGameState } from '../state/gameStateStore'
import { useGameAct } from '../screens/useGameAct'
import { useGameplaySettings } from '../settings/gameplaySettingsStore'
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
import { noteFailure } from '../../../store/problems'

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
const name = (a: Ability) => String(a.params.label || a.id)

function ActiveBar({
  visitor,
  catalog,
  aiming,
  onAim
}: {
  visitor: PlaceVisitor
  catalog: Catalog
  aiming: string | null
  onAim: (aim: { uid: string; label: string } | null) => void
}) {
  const { shown, act } = useGameAct(visitor.sheet, visitor.game!, catalog)
  const entity = useMemo(() => GameEntity.fromRecord(shown, catalog), [shown, catalog])
  const abilities = useMemo(() => usableAbilities(entity), [entity])
  const slots = useActionSlots(visitor.sheet, abilities)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const allItems = useMemo(() => [
    ...(entity.comp(Inventory)?.items ?? []),
    ...(entity.comp(Equipment)?.comps.filter((c): c is Item => c instanceof Item) ?? [])
  ], [entity])

  const world = useGameState((s) => s.world)
  const battle = useGameState((s) => s.battle)

  const useSlot = (slot: ActionSlotDef | null) => {
    if (!slot) return
    if (slot.kind === 'ability') {
      const a = abilities.find((x) => x.uid === slot.uid || x.id === slot.id)
      if (!a) return
      runAbilityUse({
        sheet: visitor.sheet,
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
        sheet: visitor.sheet,
        item: foundItem,
        label: itemName(foundItem),
        world,
        battle,
        act
      })
    }
  }

  const latest = useLatest({ slots, useSlot })

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return
      const kb = useGameplaySettings.getState().settings.keybinds
      for (let i = 1; i <= 9; i += 1) {
        const code = kb[`slot${i}`]?.code ?? `Digit${i}`
        if (e.code === code) {
          const slot = latest.current.slots[i - 1]
          if (slot) {
            e.preventDefault()
            latest.current.useSlot(slot)
          }
          break
        }
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [latest])

  const handleMenu = (e: MouseEvent, index: number, slot: ActionSlotDef) => {
    e.preventDefault()
    e.stopPropagation()
    openMenu(e, slot.label, [
      {
        label: 'Clear Slot',
        danger: true,
        onSelect: () => clearActionSlot(visitor.sheet, index)
      }
    ])
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
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
    e.preventDefault()
    setOverIndex(null)

    // 1. Slot swapping
    const swapRaw = e.dataTransfer.getData(ACTION_SLOT_SWAP_MIME)
    if (swapRaw) {
      try {
        const data = JSON.parse(swapRaw)
        if (typeof data.index === 'number' && data.index !== index) {
          swapActionSlots(visitor.sheet, data.index, index)
          return
        }
      } catch (err) {
        noteFailure('play', 'Could not read the dragged slot')(err)
      }
    }

    // 2. Drag-and-drop from Spellbook or Inventory
    const actionRaw = e.dataTransfer.getData(ACTION_DRAG_MIME)
    if (actionRaw) {
      try {
        const data = JSON.parse(actionRaw) as ActionDragPayload
        setActionSlot(visitor.sheet, index, {
          kind: data.kind,
          uid: data.uid,
          id: data.id,
          label: data.label
        })
        toast.info('Action Bar', `Bound ${data.label} to Slot ${index + 1}`)
      } catch (err) {
        noteFailure('play', 'Could not read the dragged action')(err)
      }
    }
  }

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-50 flex -translate-x-1/2 gap-1.5 border border-line-strong tone-panel-95 p-1.5 shadow-[0_20px_48px_color-mix(in_srgb,var(--color-shade)_98%,transparent)] backdrop-blur-[calc(var(--panel-blur)*1.5)]">
      {Array.from({ length: 9 }).map((_, i) => {
        const slot = slots[i]
        const isOver = overIndex === i

        if (!slot) {
          return (
            <div
              key={i}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragLeave={() => handleDragLeave(i)}
              onDrop={(e) => handleDrop(e, i)}
              className={cn(
                'relative flex h-[50px] w-[50px] select-none items-center justify-center border font-ui transition-all',
                isOver
                  ? 'border-tint-cyan bg-tint-cyan/25 shadow-[0_0_18px_color-mix(in_srgb,var(--color-tint-cyan)_calc(70%*var(--glow)),transparent)] scale-105'
                  : 'border-line/40 tone-well-60 hover:border-line'
              )}
              title={`Slot ${i + 1} (Empty)`}
            >
              <span className="absolute left-1.5 top-1 text-[10px] font-bold text-dim/80">{i + 1}</span>
              <span className="text-[14px] text-line-strong/40 font-ui select-none">+</span>
            </div>
          )
        }

        if (slot.kind === 'ability') {
          const a = abilities.find((x) => x.uid === slot.uid || x.id === slot.id)
          const sourceClassId = String(a?.params.sourceClass || '')
          const sourceClassTitle = sourceClassId
            ? entity.comp(Classes)?.byId(sourceClassId)?.title || String(catalog.template('game_class', sourceClassId)?.label || sourceClassId)
            : ''
          const ready = a ? a.canUse({ user: entity, target: entity, at: null, distance: 0 }) : 'not available'
          const actionCost = String(a?.params.action || 'action')
          const canSpendCost = a ? canSpendTurnCost(battle, visitor.sheet, actionCost) : true
          const slotAvailable = ready === true && canSpendCost
          const rows = a
            ? [
                ...Object.entries(a.cost).map(([s, n]) => ({ label: catalog.stat(s)?.label ?? s, value: String(n) })),
                ...a.comps.flatMap((c) => c.tooltipRows())
              ]
            : []
          const body = (
            <span className="flex min-w-48 flex-col gap-1.5">
              {sourceClassTitle && (
                <span className="font-ui text-[11px] text-tint-cyan">
                  from class {sourceClassTitle}
                </span>
              )}
              {a?.item && (
                <span className="font-ui text-[11px] text-tint-purple">
                  from {String(a.item.params.label || a.item.id)}
                </span>
              )}
              <RowList rows={[{ label: 'Range', value: a && a.reach() ? `${a.reach()} ft` : 'self' }, ...rows]} />
              {ready !== true && <span className="text-[11.5px] text-alert">{ready}</span>}
              <span className="border-t border-line/40 pt-1 text-[10px] text-faint">
                Right-click to clear
              </span>
            </span>
          )

          const label = a ? name(a) : slot.label
          const theme = slotThemeFor(a?.comps)
          const Icon = theme.Icon

          return (
            <button
              key={`ability-${i}`}
              type="button"
              draggable
              onDragStart={(e) => {
                hideTip('component')
                e.dataTransfer.setData(
                  ACTION_SLOT_SWAP_MIME,
                  JSON.stringify({ index: i, sheet: visitor.sheet })
                )
                e.dataTransfer.effectAllowed = 'move'
                setCompactDragGhost(e, label, '#66fcf1')
              }}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragLeave={() => handleDragLeave(i)}
              onDrop={(e) => handleDrop(e, i)}
              onClick={() => useSlot(slot)}
              onContextMenu={(e) => handleMenu(e, i, slot)}
              onMouseEnter={(e) => showTip(e.currentTarget, label, body, 'top')}
              onMouseLeave={() => hideTip('component')}
              className={cn(
                'group relative flex h-[50px] w-[50px] items-center justify-center border font-ui text-[12px] font-bold cursor-grab active:cursor-grabbing transition-all',
                isOver && 'border-tint-cyan bg-tint-cyan/25 shadow-[0_0_18px_color-mix(in_srgb,var(--color-tint-cyan)_calc(70%*var(--glow)),transparent)] scale-105',
                slotAvailable ? cn(theme.border, theme.bg, theme.color, theme.glow, 'hover:scale-105 hover:border-tint-cyan') : 'border-line/40 tone-panel-60 text-faint opacity-50',
                aiming && a && aiming === a.uid && 'border-tint-cyan bg-tint-cyan/30 text-tint-cyan shadow-[0_0_18px_color-mix(in_srgb,var(--color-tint-cyan)_calc(90%*var(--glow)),transparent)] animate-pulse'
              )}
            >
              <Icon className="h-6 w-6 transition-transform group-hover:scale-110" />
              <span className="absolute left-1.5 top-1 text-[9.5px] font-bold text-ink/90 drop-shadow-sm leading-none">{i + 1}</span>
            </button>
          )
        }

        // Item Slot
        const item = allItems.find((x) => x.uid === slot.uid || x.id === slot.id)
        const tip = item ? itemTip(item) : null
        const itemLabel = item ? itemName(item) : slot.label
        const count = item?.count ?? 0
        const theme = slotThemeFor(item?.comps, true)
        const Icon = theme.Icon

        return (
          <button
            key={`item-${i}`}
            type="button"
            draggable
            onDragStart={(e) => {
              hideTip('component')
              e.dataTransfer.setData(
                ACTION_SLOT_SWAP_MIME,
                JSON.stringify({ index: i, sheet: visitor.sheet })
              )
              e.dataTransfer.effectAllowed = 'move'
              setCompactDragGhost(e, itemLabel, '#38bdf8')
            }}
            onDragOver={(e) => handleDragOver(e, i)}
            onDragLeave={() => handleDragLeave(i)}
            onDrop={(e) => handleDrop(e, i)}
            onClick={() => useSlot(slot)}
            onContextMenu={(e) => handleMenu(e, i, slot)}
            onMouseEnter={(e) =>
              tip
                ? showTip(
                    e.currentTarget,
                    tip.title,
                    <span className="flex flex-col gap-1.5">
                      {tip.body}
                      <span className="border-t border-line/40 pt-1 text-[10px] text-faint">
                        Right-click to clear
                      </span>
                    </span>,
                    'top'
                  )
                : undefined
            }
            onMouseLeave={() => hideTip('component')}
            className={cn(
              'group relative flex h-[50px] w-[50px] items-center justify-center border font-ui text-[12px] font-bold cursor-grab active:cursor-grabbing transition-all',
              isOver && 'border-tint-cyan bg-tint-cyan/25 shadow-[0_0_18px_color-mix(in_srgb,var(--color-tint-cyan)_calc(70%*var(--glow)),transparent)] scale-105',
              item && item.usable()
                ? cn(theme.border, theme.bg, theme.color, theme.glow, 'hover:scale-105 hover:border-tint-cyan')
                : 'border-line/40 tone-panel-60 text-faint'
            )}
          >
            <Icon className="h-6 w-6 transition-transform group-hover:scale-110" />
            <span className="absolute left-1.5 top-1 text-[9.5px] font-bold text-ink/90 drop-shadow-sm leading-none">{i + 1}</span>
            {count > 1 && (
              <span className="absolute right-1 bottom-0.5 border border-accent/40 tone-panel-90 px-1 font-ui text-[9px] font-bold text-accent shadow-sm">
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function EmptyBar() {
  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-50 flex -translate-x-1/2 gap-1.5 border border-line-strong tone-panel-95 p-1.5 shadow-[0_16px_40px_color-mix(in_srgb,var(--color-shade)_95%,transparent)]">
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className="relative flex h-12 w-12 select-none items-center justify-center border border-line/60 tone-well-60 font-ui shadow-inner transition-colors hover:border-line"
          title={`Slot ${i + 1} (Empty)`}
        >
          <span className="absolute left-1.5 top-0.5 font-ui text-[10px] font-bold text-dim">{i + 1}</span>
          <span className="text-[12px] text-line-strong/40">+</span>
        </div>
      ))}
    </div>
  )
}

export function ActionBarHud({
  visitor,
  catalog,
  aiming,
  onAim
}: {
  visitor: PlaceVisitor | null
  catalog: Catalog | null
  aiming: string | null
  onAim: (aim: { uid: string; label: string } | null) => void
}) {
  if (visitor && visitor.game && catalog) {
    return <ActiveBar key={visitor.sheet} visitor={visitor} catalog={catalog} aiming={aiming} onAim={onAim} />
  }
  return <EmptyBar />
}
