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
  Scroll
} from 'lucide-react'
import { Equipment, Inventory, Item, usableAbilities, type Ability } from '@shared/game/components'
import { GameEntity, type Catalog } from '@shared/game/core'
import type { PlaceVisitor } from '@shared/maps'
import { cn } from '../../../lib/cn'
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

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
const name = (a: Ability) => String(a.params.label || a.id)

function getSlotTheme(name: string) {
  const n = name.toLowerCase()
  if (n.includes('fire') || n.includes('flame') || n.includes('burn') || n.includes('pyro')) {
    return { Icon: Flame, color: 'text-amber-400', border: 'border-amber-500/70', bg: 'bg-amber-500/15', glow: 'shadow-[0_0_12px_rgba(245,158,11,0.35)]' }
  }
  if (n.includes('cold') || n.includes('ice') || n.includes('frost') || n.includes('water')) {
    return { Icon: Droplets, color: 'text-sky-400', border: 'border-sky-500/70', bg: 'bg-sky-500/15', glow: 'shadow-[0_0_12px_rgba(56,189,248,0.35)]' }
  }
  if (n.includes('light') || n.includes('shock') || n.includes('thunder') || n.includes('zap') || n.includes('spark')) {
    return { Icon: Zap, color: 'text-yellow-400', border: 'border-yellow-500/70', bg: 'bg-yellow-500/15', glow: 'shadow-[0_0_12px_rgba(250,204,21,0.35)]' }
  }
  if (n.includes('shield') || n.includes('ward') || n.includes('armor') || n.includes('protect') || n.includes('guard')) {
    return { Icon: Shield, color: 'text-cyan', border: 'border-cyan/70', bg: 'bg-cyan/15', glow: 'shadow-[0_0_12px_rgba(102,252,241,0.35)]' }
  }
  if (n.includes('heal') || n.includes('cure') || n.includes('restor') || n.includes('life')) {
    return { Icon: Heart, color: 'text-emerald-400', border: 'border-emerald-500/70', bg: 'bg-emerald-500/15', glow: 'shadow-[0_0_12px_rgba(52,211,153,0.35)]' }
  }
  if (n.includes('potion') || n.includes('draught') || n.includes('elixir') || n.includes('flask')) {
    return { Icon: FlaskConical, color: 'text-emerald-400', border: 'border-emerald-500/70', bg: 'bg-emerald-500/15', glow: 'shadow-[0_0_12px_rgba(52,211,153,0.35)]' }
  }
  if (n.includes('scroll') || n.includes('tome') || n.includes('parchment') || n.includes('book')) {
    return { Icon: Scroll, color: 'text-purple-400', border: 'border-purple-500/70', bg: 'bg-purple-500/15', glow: 'shadow-[0_0_12px_rgba(192,132,252,0.35)]' }
  }
  if (n.includes('necro') || n.includes('death') || n.includes('decay') || n.includes('curse') || n.includes('dark')) {
    return { Icon: Skull, color: 'text-purple-400', border: 'border-purple-500/70', bg: 'bg-purple-500/15', glow: 'shadow-[0_0_12px_rgba(192,132,252,0.35)]' }
  }
  if (n.includes('sword') || n.includes('slash') || n.includes('strike') || n.includes('dagger') || n.includes('weapon')) {
    return { Icon: Swords, color: 'text-red-400', border: 'border-red-500/70', bg: 'bg-red-500/15', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.35)]' }
  }
  return { Icon: Sparkles, color: 'text-cyan', border: 'border-cyan/70', bg: 'bg-cyan/15', glow: 'shadow-[0_0_12px_rgba(102,252,241,0.3)]' }
}

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

  const useSlot = (slot: ActionSlotDef | null) => {
    if (!slot) return
    if (slot.kind === 'ability') {
      const a = abilities.find((x) => x.uid === slot.uid || x.id === slot.id)
      if (a && a.reach() > 0) return onAim(aiming === a.uid ? null : { uid: a.uid, label: name(a) })
      act((e) => {
        const found = usableAbilities(e).find((x) => x.uid === slot.uid || x.id === slot.id)
        return found ? found.use({ user: e, target: e, at: null, distance: 0 }) : 'it is gone'
      })
    } else if (slot.kind === 'item') {
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

  const latest = useLatest({ slots, useSlot })

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return
      const n = Number(e.key)
      if (n >= 1 && n <= 9) {
        const slot = latest.current.slots[n - 1]
        if (slot) {
          e.preventDefault()
          latest.current.useSlot(slot)
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
      } catch {}
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
      } catch {}
    }
  }

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-50 flex -translate-x-1/2 gap-1.5 border border-[#2b3c4c] bg-[#05080c]/95 p-1.5 shadow-[0_20px_48px_rgba(0,0,0,0.98)] backdrop-blur-md">
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
                'relative flex h-[50px] w-[50px] select-none items-center justify-center border font-mono transition-all',
                isOver
                  ? 'border-cyan bg-cyan/25 shadow-[0_0_18px_rgba(102,252,241,0.7)] scale-105'
                  : 'border-[#223240] bg-[#070c12] hover:border-line-bright'
              )}
              title={`Slot ${i + 1} (Empty)`}
            >
              <span className="absolute left-1.5 top-1 text-[10px] font-bold text-dim/80">{i + 1}</span>
              <span className="text-[14px] text-line-bright/40 font-mono select-none">+</span>
            </div>
          )
        }

        if (slot.kind === 'ability') {
          const a = abilities.find((x) => x.uid === slot.uid || x.id === slot.id)
          const ready = a ? a.canUse({ user: entity, target: entity, at: null, distance: 0 }) : 'not available'
          const cooling = a ? a.cooling > 0 : false
          const rows = a
            ? [
                ...Object.entries(a.cost).map(([s, n]) => ({ label: catalog.stat(s)?.label ?? s, value: String(n) })),
                ...a.comps.flatMap((c) => c.tooltipRows())
              ]
            : []
          const body = (
            <span className="flex min-w-48 flex-col gap-1.5">
              {a?.item && (
                <span className="font-mono text-[11px] text-purple">
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
          const theme = getSlotTheme(label)
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
                'group relative flex h-[50px] w-[50px] items-center justify-center border font-mono text-[12px] font-bold cursor-grab active:cursor-grabbing transition-all',
                isOver && 'border-cyan bg-cyan/25 shadow-[0_0_18px_rgba(102,252,241,0.7)] scale-105',
                ready === true ? cn(theme.border, theme.bg, theme.color, theme.glow, 'hover:scale-105 hover:border-cyan') : 'border-line/40 bg-black/60 text-faint',
                aiming && a && aiming === a.uid && 'border-cyan bg-cyan/30 text-cyan shadow-[0_0_18px_rgba(102,252,241,0.9)] animate-pulse'
              )}
            >
              <Icon className="h-6 w-6 transition-transform group-hover:scale-110" />
              <span className="absolute left-1.5 top-1 text-[9.5px] font-bold text-white/90 drop-shadow-sm leading-none">{i + 1}</span>
              {cooling && a && (
                <span className="absolute inset-x-0 bottom-0 bg-black/90 text-center text-[9px] font-bold text-dim">
                  {gameTime(a.cooling)}
                </span>
              )}
            </button>
          )
        }

        // Item Slot
        const item = allItems.find((x) => x.uid === slot.uid || x.id === slot.id)
        const tip = item ? itemTip(item) : null
        const itemLabel = item ? itemName(item) : slot.label
        const count = item?.count ?? 0
        const theme = getSlotTheme(itemLabel)
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
              'group relative flex h-[50px] w-[50px] items-center justify-center border font-mono text-[12px] font-bold cursor-grab active:cursor-grabbing transition-all',
              isOver && 'border-cyan bg-cyan/25 shadow-[0_0_18px_rgba(102,252,241,0.7)] scale-105',
              item && item.usable()
                ? cn(theme.border, theme.bg, theme.color, theme.glow, 'hover:scale-105 hover:border-cyan')
                : 'border-line/40 bg-black/60 text-faint'
            )}
          >
            <Icon className="h-6 w-6 transition-transform group-hover:scale-110" />
            <span className="absolute left-1.5 top-1 text-[9.5px] font-bold text-white/90 drop-shadow-sm leading-none">{i + 1}</span>
            {count > 1 && (
              <span className="absolute right-1 bottom-0.5 border border-accent/40 bg-black/90 px-1 font-mono text-[9px] font-bold text-accent shadow-sm">
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
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-50 flex -translate-x-1/2 gap-1.5 border border-line-bright bg-black/95 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.95)]">
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className="relative flex h-12 w-12 select-none items-center justify-center border border-line/60 bg-[#070b10] font-mono shadow-inner transition-colors"
          title={`Slot ${i + 1} (Empty)`}
        >
          <span className="absolute left-1.5 top-0.5 font-mono text-[10px] font-bold text-dim">{i + 1}</span>
          <span className="text-[12px] text-line-bright/40">+</span>
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
