import { useRef, type MouseEvent, type PointerEvent } from 'react'
import { Zap, MousePointerClick } from 'lucide-react'
import { shapeBounds, type Point, type Size } from '@shared/shapes'
import type { TriggerDef } from '@shared/game/triggers'
import { OutlinePath } from '../shapes/OutlinePath'
import { useViewZoom } from '../space/viewZoom'
import { useSpaceDrag } from '../space/useSpaceDrag'
import { cn } from '../../lib/cn'

interface Props {
  size: Size
  triggers: TriggerDef[]
  selected?: string | null
  onPick?: (trigger: TriggerDef) => void
  onMove?: (id: string, delta: Point) => void
  onResize?: (id: string, w: number, h: number) => void
  onMenu?: (e: MouseEvent, trigger: TriggerDef) => void
  routed?: boolean
  className?: string
}

type DragMode = 'move' | 'resize'

function TriggerZone({
  trigger: t,
  index,
  selected,
  routed,
  onPick,
  onMove,
  onResize,
  onMenu
}: {
  trigger: TriggerDef
  index: number
  selected: boolean
  routed: boolean
  onPick?: (trigger: TriggerDef) => void
  onMove?: (id: string, delta: Point) => void
  onResize?: (id: string, w: number, h: number) => void
  onMenu?: (e: MouseEvent, trigger: TriggerDef) => void
}) {
  const zoom = useViewZoom()
  const boxRef = useRef<HTMLDivElement>(null)
  const canDrag = Boolean(onMove)
  const canResize = Boolean(onResize && t.shape.kind === 'box')

  const drag = useSpaceDrag<DragMode>(
    canDrag,
    (d) => {
      onPick?.(t)
      const dx = Math.round(d.delta.x / zoom)
      const dy = Math.round(d.delta.y / zoom)
      if (d.mode === 'resize' && canResize) {
        const b = shapeBounds(t.shape)
        onResize?.(t.id, Math.max(16, Math.round(b.w + dx)), Math.max(16, Math.round(b.h + dy)))
        return
      }
      if (dx || dy) onMove?.(t.id, { x: dx, y: dy })
    },
    () => onPick?.(t)
  )

  const baseBounds = shapeBounds(t.shape)
  const dxLive = drag.live ? drag.live.delta.x / zoom : 0
  const dyLive = drag.live ? drag.live.delta.y / zoom : 0
  const isResizing = drag.live?.mode === 'resize'
  const left = isResizing ? baseBounds.x : baseBounds.x + dxLive
  const top = isResizing ? baseBounds.y : baseBounds.y + dyLive
  const width = isResizing ? Math.max(16, baseBounds.w + dxLive) : baseBounds.w
  const height = isResizing ? Math.max(16, baseBounds.h + dyLive) : baseBounds.h
  const isEnter = t.fires === 'enter'
  const interactive = canDrag || !routed

  return (
    <div
      ref={boxRef}
      role="button"
      tabIndex={-1}
      draggable={false}
      data-hit={interactive || undefined}
      data-keep={canDrag || undefined}
      title={`${t.name} (${t.type}) · Fires on ${t.fires}${canDrag ? ' · Drag to move' : ''}`}
      onPointerDown={
        canDrag
          ? (e: PointerEvent<HTMLDivElement>) => {
              if (e.button !== 0) return
              e.preventDefault()
              e.stopPropagation()
              drag.begin('move', boxRef)(e)
            }
          : undefined
      }
      onPointerMove={canDrag ? drag.move : undefined}
      onPointerUp={canDrag ? drag.end : undefined}
      onPointerCancel={canDrag ? drag.end : undefined}
      onClick={
        !canDrag && !routed
          ? (e) => {
              e.stopPropagation()
              onPick?.(t)
            }
          : undefined
      }
      onContextMenu={
        onMenu
          ? (e) => {
              e.preventDefault()
              e.stopPropagation()
              onMenu(e, t)
            }
          : undefined
      }
      style={{
        left,
        top,
        width,
        height,
        animationDelay: `${0.1 + index * 0.05}s`
      }}
      className={cn(
        'absolute border-2 border-dashed transition-colors font-ui touch-none select-none',
        interactive ? 'pointer-events-auto' : 'pointer-events-none',
        canDrag ? 'cursor-grab active:cursor-grabbing' : interactive ? 'cursor-pointer' : '',
        selected
          ? 'z-[16] border-accent bg-accent/20 shadow-[0_0_12px_color-mix(in_srgb,var(--color-accent)_calc(40%*var(--glow)),transparent)]'
          : 'z-[15] border-accent/70 bg-accent/10 hover:border-accent hover:bg-accent/20'
      )}
    >
      {t.shape.kind === 'outline' && <OutlinePath points={t.shape.points} bounds={baseBounds} />}
      <span
        className={cn(
          'absolute -top-3.5 left-1 flex items-center gap-1 border px-1.5 py-px text-[9px] font-bold caps shadow-sm select-none',
          canDrag ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none',
          isEnter
            ? 'border-accent tone-panel-90 text-accent'
            : 'border-secondary-ink tone-panel-90 text-secondary-ink'
        )}
      >
        {isEnter ? <Zap className="h-2.5 w-2.5 text-accent shrink-0" /> : <MousePointerClick className="h-2.5 w-2.5 text-secondary-ink shrink-0" />}
        <span className="truncate max-w-[140px]">{t.name}</span>
      </span>
      {selected && canResize && (
        <span
          data-hit
          data-keep
          title="Drag to resize trigger"
          onPointerDown={(e: PointerEvent<HTMLSpanElement>) => {
            if (e.button !== 0) return
            e.preventDefault()
            e.stopPropagation()
            drag.begin('resize', boxRef)(e)
          }}
          onPointerMove={drag.move}
          onPointerUp={drag.end}
          onPointerCancel={drag.end}
          className="shape-handle pointer-events-auto -bottom-1.5 -right-1.5 cursor-nwse-resize"
        />
      )}
    </div>
  )
}

export function TriggerOverlay({ triggers, selected, onPick, onMove, onResize, onMenu, routed = false, className }: Props) {
  if (!triggers.length) return null

  return (
    <div className={cn('pointer-events-none absolute inset-0 z-[15]', className)}>
      {triggers.map((t, i) => (
        <TriggerZone
          key={t.id}
          trigger={t}
          index={i}
          selected={t.id === selected}
          routed={routed}
          onPick={onPick}
          onMove={onMove}
          onResize={onResize}
          onMenu={onMenu}
        />
      ))}
    </div>
  )
}
