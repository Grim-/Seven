import type { CSSProperties } from 'react'
import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

interface PanelProps {
  title?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  loading?: boolean
  className?: string
  style?: CSSProperties
  bodyClassName?: string
  children: ReactNode
}

export function Panel({ title, meta, actions, collapsible, defaultOpen = true, loading, className, style, bodyClassName, children }: PanelProps) {
  const [open, setOpen] = useState(defaultOpen)
  const hasHeader = title || actions || meta
  return (
    <section style={style} className={cn('panel-box relative flex min-h-0 flex-col overflow-hidden hover:border-l-accent', className)}>
      {loading && <span className="seven-pulse" />}
      {hasHeader && (
        <header
          className={cn('flex shrink-0 items-center gap-3 border-b border-line/60 px-3.5 py-2.5', collapsible && 'cursor-pointer select-none')}
          onClick={collapsible ? () => setOpen(!open) : undefined}
        >
          {title && <h2 className="text-[14px] font-semibold uppercase tracking-[0.06em] text-white">{title}</h2>}
          {meta && <span className="font-mono text-[12px] text-dim">{meta}</span>}
          <div className="ml-auto flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
          {collapsible && <ChevronDown className={cn('h-4 w-4 text-accent transition-transform', !open && '-rotate-180')} />}
        </header>
      )}
      {open && <div className={cn('min-h-0 flex-1 p-3.5', bodyClassName)}>{children}</div>}
    </section>
  )
}
