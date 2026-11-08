import { useState, type MouseEvent, type ReactNode } from 'react'
import {
  Swords,
  Shield,
  Shirt,
  FlaskConical,
  Scroll,
  Sparkles,
  Zap,
  Flame,
  Droplets,
  Package
} from 'lucide-react'
import { hideTip, showTip } from '../../components/ui/TooltipHost'
import { cn } from '../../lib/cn'
import { ACTION_DRAG_MIME, setCompactDragGhost, type ActionDragPayload } from '../../components/play/hud/actionSlots'

const MIME = 'application/x-seven-item'

export interface ItemDrag {
  uid: string
  from: string
}

export interface SlotItem {
  uid: string
  label: string
  count: number
}

function getItemVisual(label: string) {
  const l = label.toLowerCase()
  if (l.includes('potion') || l.includes('elixir') || l.includes('flask') || l.includes('draught') || l.includes('brew')) {
    return { Icon: FlaskConical, color: 'text-emerald-400', border: 'border-emerald-500/50', glow: 'shadow-[inset_0_0_8px_rgba(52,211,153,0.2)]' }
  }
  if (l.includes('scroll') || l.includes('tome') || l.includes('parchment') || l.includes('grimoire') || l.includes('book')) {
    return { Icon: Scroll, color: 'text-purple-400', border: 'border-purple-500/50', glow: 'shadow-[inset_0_0_8px_rgba(192,132,252,0.2)]' }
  }
  if (l.includes('sword') || l.includes('blade') || l.includes('dagger') || l.includes('axe') || l.includes('bow') || l.includes('staff') || l.includes('mace') || l.includes('weapon')) {
    return { Icon: Swords, color: 'text-amber-400', border: 'border-amber-500/50', glow: 'shadow-[inset_0_0_8px_rgba(245,158,11,0.2)]' }
  }
  if (l.includes('shield') || l.includes('buckler') || l.includes('ward')) {
    return { Icon: Shield, color: 'text-cyan', border: 'border-cyan/50', glow: 'shadow-[inset_0_0_8px_rgba(102,252,241,0.2)]' }
  }
  if (l.includes('armor') || l.includes('mail') || l.includes('plate') || l.includes('leather') || l.includes('robe') || l.includes('chest') || l.includes('vest')) {
    return { Icon: Shirt, color: 'text-sky-400', border: 'border-sky-500/50', glow: 'shadow-[inset_0_0_8px_rgba(56,189,248,0.2)]' }
  }
  if (l.includes('ring') || l.includes('amulet') || l.includes('gem') || l.includes('crystal') || l.includes('charm') || l.includes('relic')) {
    return { Icon: Sparkles, color: 'text-cyan', border: 'border-cyan/50', glow: 'shadow-[inset_0_0_8px_rgba(102,252,241,0.2)]' }
  }
  if (l.includes('fire') || l.includes('flame') || l.includes('torch')) {
    return { Icon: Flame, color: 'text-amber-400', border: 'border-amber-500/50', glow: 'shadow-[inset_0_0_8px_rgba(245,158,11,0.2)]' }
  }
  if (l.includes('water') || l.includes('ice') || l.includes('frost')) {
    return { Icon: Droplets, color: 'text-sky-400', border: 'border-sky-500/50', glow: 'shadow-[inset_0_0_8px_rgba(56,189,248,0.2)]' }
  }
  if (l.includes('lightning') || l.includes('spark') || l.includes('shock')) {
    return { Icon: Zap, color: 'text-yellow-400', border: 'border-yellow-500/50', glow: 'shadow-[inset_0_0_8px_rgba(250,204,21,0.2)]' }
  }
  return { Icon: Package, color: 'text-white/80', border: 'border-line/60', glow: 'shadow-[inset_0_0_8px_rgba(255,255,255,0.05)]' }
}

export function ItemSlot({
  item,
  from,
  label,
  icon,
  selected,
  dim,
  tip,
  onDropItem,
  onClick,
  onDoubleClick,
  onMenu,
  className
}: {
  item: SlotItem | null
  from: string
  label?: string
  icon?: ReactNode
  selected?: boolean
  dim?: boolean
  tip?: { title: string; body: ReactNode }
  onDropItem?: (drag: ItemDrag) => void
  onClick?: () => void
  onDoubleClick?: () => void
  onMenu?: (e: MouseEvent) => void
  className?: string
}) {
  const [over, setOver] = useState(false)
  const visual = item ? getItemVisual(item.label) : null
  const ItemIcon = visual?.Icon

  return (
    <div
      draggable={!!item}
      onDragStart={(e) => {
        if (!item) return
        hideTip('component')
        e.dataTransfer.setData(MIME, JSON.stringify({ uid: item.uid, from } satisfies ItemDrag))
        e.dataTransfer.setData(
          ACTION_DRAG_MIME,
          JSON.stringify({ kind: 'item', uid: item.uid, id: item.uid, label: item.label } satisfies ActionDragPayload)
        )
        e.dataTransfer.effectAllowed = 'move'
        setCompactDragGhost(e, item.label, '#38bdf8')
      }}
      onDragOver={(e) => {
        if (!onDropItem || !e.dataTransfer.types.includes(MIME)) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false)
        const raw = e.dataTransfer.getData(MIME)
        if (!raw || !onDropItem) return
        e.preventDefault()
        const drag = JSON.parse(raw) as ItemDrag
        if (drag.from !== from || drag.uid !== item?.uid) onDropItem(drag)
      }}
      onMouseEnter={(e) => tip && showTip(e.currentTarget, tip.title, tip.body, 'top')}
      onMouseLeave={() => hideTip('component')}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onMenu}
      className={cn(
        'group relative flex aspect-square min-w-0 select-none items-center justify-center border bg-[#06090e] transition-all',
        item
          ? cn(
              'cursor-grab active:cursor-grabbing hover:border-cyan hover:scale-[1.02]',
              visual?.border,
              visual?.glow
            )
          : 'border-line/40 hover:border-line-bright',
        selected && 'border-cyan ring-1 ring-cyan bg-cyan/10 shadow-[0_0_12px_rgba(102,252,241,0.4)]',
        over && 'border-cyan bg-cyan/20 scale-105 shadow-[0_0_16px_rgba(102,252,241,0.6)]',
        dim && 'opacity-40',
        className
      )}
    >
      {/* Slot label watermark */}
      {label && (
        <span
          className={cn(
            'pointer-events-none absolute left-1 top-0.5 truncate font-mono text-[9px] uppercase tracking-[0.08em]',
            item ? 'text-faint' : 'text-dim'
          )}
        >
          {label}
        </span>
      )}

      {/* Empty slot watermark icon */}
      {!item && icon && (
        <span className="pointer-events-none text-faint/40 group-hover:text-faint/70 transition-colors [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </span>
      )}

      {/* Filled item icon */}
      {item && ItemIcon && (
        <ItemIcon className={cn('pointer-events-none h-5 w-5 transition-transform group-hover:scale-110', visual?.color)} />
      )}

      {/* Stack count badge */}
      {item && item.count > 1 && (
        <span className="pointer-events-none absolute bottom-0.5 right-1 border border-accent/40 bg-black/90 px-1 font-mono text-[10px] font-bold text-accent shadow-sm">
          {item.count}
        </span>
      )}
    </div>
  )
}
