import type { MouseEvent, ReactNode } from 'react'
import { shapeBounds, type Shape, type Size } from '@shared/shapes'
import { cn } from '../../lib/cn'
import { boundsStyle } from './boundsStyle'
import { OutlinePath } from './OutlinePath'

interface Props {
  size: Size
  shapes: Shape[]
  selected?: string | null
  onPick?: (shape: Shape) => void
  onMenu?: (e: MouseEvent, shape: Shape) => void
  marks?: (shape: Shape) => ReactNode
  className?: string
}

export function ShapeOverlay({ size, shapes, selected, onPick, onMenu, marks, className }: Props) {
  if (!shapes.length) return null
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
            disabled={!onPick}
            data-form={s.form.kind}
            data-on={s.id === selected || undefined}
            onClick={(e) => {
              e.stopPropagation()
              onPick?.(s)
            }}
            onContextMenu={onMenu && ((e) => onMenu(e, s))}
            style={{ ...boundsStyle(bounds, size), animationDelay: `${0.25 + i * 0.12}s` }}
            className={cn('area-hot absolute', outline ? 'pointer-events-none' : 'pointer-events-auto', onPick ? 'cursor-pointer' : 'cursor-default')}
          >
            {s.form.kind === 'outline' && <OutlinePath points={s.form.points} bounds={bounds} />}
            {s.label && <span className="area-tag">{s.label}</span>}
            {marks && <span className="shape-marks">{marks(s)}</span>}
          </button>
        )
      })}
    </span>
  )
}
