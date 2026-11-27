import { useState, type MouseEvent, type ReactNode } from 'react'
import { hideTip, showTip } from '../../components/ui/TooltipHost'
import { cn } from '../../lib/cn'
import { ACTION_DRAG_MIME, setCompactDragGhost, type ActionDragPayload } from '../../components/play/hud/actionSlots'
import { getGameVisual } from './gameVisuals'

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

export function ItemSlot({
  item,
  from,
  label,
  icon,
  compact,
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
  compact?: boolean
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
  const visual = item ? getGameVisual(item.label, '', 'item') : null
  const ItemIcon = visual?.Icon

  const dragProps = {
    draggable: !!item,
    onDragStart: (e: React.DragEvent<HTMLDivElement>) => {
      if (!item) return
      hideTip('component')
      e.dataTransfer.setData(MIME, JSON.stringify({ uid: item.uid, from } satisfies ItemDrag))
      e.dataTransfer.setData(
        ACTION_DRAG_MIME,
        JSON.stringify({ kind: 'item', uid: item.uid, id: item.uid, label: item.label } satisfies ActionDragPayload)
      )
      e.dataTransfer.effectAllowed = 'move'
      setCompactDragGhost(e, item.label, '#38bdf8')
    },
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => {
      if (!onDropItem || !e.dataTransfer.types.includes(MIME)) return
      e.preventDefault()
      setOver(true)
    },
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent<HTMLDivElement>) => {
      setOver(false)
      const raw = e.dataTransfer.getData(MIME)
      if (!raw || !onDropItem) return
      e.preventDefault()
      const drag = JSON.parse(raw) as ItemDrag
      if (drag.from !== from || drag.uid !== item?.uid) onDropItem(drag)
    },
    onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => tip && showTip(e.currentTarget, tip.title, tip.body, 'top'),
    onMouseLeave: () => hideTip('component'),
    onClick,
    onDoubleClick,
    onContextMenu: onMenu
  }

  if (compact) {
    return (
      <div
        {...dragProps}
        className={cn(
          'group flex h-8 min-w-0 select-none items-center gap-1.5 border px-2 transition-colors',
          item
            ? 'cursor-grab border-line/60 tone-panel-50 hover:border-tint-cyan/70 active:cursor-grabbing'
            : 'border-line/30 tone-panel-25 hover:border-line/60',
          selected && 'border-tint-cyan bg-tint-cyan/10',
          over && 'border-tint-cyan bg-tint-cyan/15',
          dim && 'opacity-40',
          className
        )}
      >
        {item && ItemIcon ? (
          <ItemIcon className={cn('h-3.5 w-3.5 shrink-0', visual?.color)} />
        ) : (
          icon && <span className="shrink-0 text-faint/55 [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
        )}
        {label && (
          <span className="shrink-0 font-label text-[9.5px] caps-8 text-dim">{label}</span>
        )}
        <span className={cn('min-w-0 flex-1 truncate text-[12px]', item ? 'font-medium text-ink' : 'text-faint')}>
          {item ? item.label : '—'}
        </span>
        {item && item.count > 1 && (
          <span className="shrink-0 font-data text-[10.5px] font-semibold tabular-nums text-accent">
            ×{item.count}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      {...dragProps}
      className={cn(
        'group relative flex aspect-square min-w-0 select-none items-center justify-center border bg-surface transition-all',
        item
          ? cn(
              'cursor-grab active:cursor-grabbing hover:border-tint-cyan hover:scale-[1.02]',
              visual?.border,
              visual?.glow
            )
          : 'border-line/40 hover:border-line-strong',
        selected && 'border-tint-cyan ring-1 ring-tint-cyan bg-tint-cyan/10 shadow-[0_0_12px_color-mix(in_srgb,var(--color-tint-cyan)_calc(40%*var(--glow)),transparent)]',
        over && 'border-tint-cyan bg-tint-cyan/20 scale-105 shadow-[0_0_16px_color-mix(in_srgb,var(--color-tint-cyan)_calc(60%*var(--glow)),transparent)]',
        dim && 'opacity-40',
        className
      )}
    >
      {/* Slot label watermark */}
      {label && (
        <span
          className={cn(
            'pointer-events-none absolute left-1 top-0.5 truncate font-label text-[9px] caps-8 ',
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
        <span className="pointer-events-none absolute bottom-0.5 right-1 border border-accent/40 tone-panel-90 px-1 font-ui text-[10px] font-bold text-accent shadow-sm">
          {item.count}
        </span>
      )}
    </div>
  )
}
