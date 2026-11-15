import { useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { NearAlign, NearSide } from '../../lib/fitNear'
import { FloatLayer } from './FloatLayer'

export function Popover({
  trigger,
  children,
  className,
  rootClassName,
  triggerClassName,
  title,
  side = 'bottom',
  align = 'end',
  disabled = false
}: {
  trigger: ReactNode
  children: ReactNode | ((close: () => void) => ReactNode)
  className?: string
  rootClassName?: string
  triggerClassName?: string
  title?: string
  side?: NearSide
  align?: NearAlign
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)
  return (
    <div ref={root} className={cn('relative', rootClassName)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onContextMenu={(e) => {
          if (disabled) return
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        disabled={disabled}
        title={title}
        className={cn('flex items-center text-left', triggerClassName)}
      >
        {trigger}
      </button>
      {open && (
        <FloatLayer anchor={root} onClose={close} side={side} align={align} className={className}>
          {typeof children === 'function' ? children(close) : children}
        </FloatLayer>
      )}
    </div>
  )
}
