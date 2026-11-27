import type { MouseEvent, ReactNode } from 'react'
import { shapeBounds, type Shape, type Size } from '@shared/shapes'
import { cn } from '../../lib/cn'
import { boundsStyle } from './boundsStyle'
import { OutlinePath } from './OutlinePath'

interface Props {
  size: Size
  shapes: Shape[]
  selected?: string | null
  variant?: 'place' | 'region'
  passive?: boolean
  routed?: boolean
  onPick?: (shape: Shape) => void
  onMenu?: (e: MouseEvent, shape: Shape) => void
  marks?: (shape: Shape) => ReactNode
  className?: string
}

export function ShapeOverlay({ size, shapes, selected, variant = 'place', passive = false, routed = false, onPick, onMenu, marks, className }: Props) {
  if (!shapes.length) return null
  const inert = routed || passive || (!onPick && !onMenu)
  return (
    <span className={cn('pointer-events-none absolute inset-0 z-[3]', className)}>
      {shapes.map((s, i) => {
        const bounds = shapeBounds(s.form)
        const outline = s.form.kind === 'outline'
        return (
          <button
            key={s.id}
            type="button"
            title={s.title || s.label}
            disabled={!routed && (!onPick || inert)}
            data-form={s.form.kind}
            data-variant={variant}
            data-on={s.id === selected || undefined}
            onClick={(e) => {
              if (inert) return
              e.stopPropagation()
              onPick?.(s)
            }}
            onContextMenu={!inert && onMenu ? (e) => onMenu(e, s) : undefined}
            style={{ ...boundsStyle(bounds, size), animationDelay: `${0.25 + i * 0.12}s` }}
            className={cn(
              'area-hot absolute',
              inert ? 'pointer-events-none [&_polygon]:!pointer-events-none' : outline ? 'pointer-events-none' : 'pointer-events-auto',
              onPick && !inert ? 'cursor-pointer' : 'cursor-default'
            )}
          >
            {s.form.kind === 'outline' && <OutlinePath points={s.form.points} bounds={bounds} />}
            {s.label && <span className="area-tag">{s.label}</span>}
            {marks && <span className={cn('shape-marks', inert && !routed && '!pointer-events-none')}>{marks(s)}</span>}
          </button>
        )
      })}
    </span>
  )
}
