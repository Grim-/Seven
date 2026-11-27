import type { CSSProperties } from 'react'
import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'
import { skinSurface } from '../skins/skinSurface'

interface PanelProps {
  lead?: ReactNode
  tail?: ReactNode
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

export function Panel({ lead, tail, title, meta, actions, collapsible, defaultOpen = true, loading, className, style, bodyClassName, children }: PanelProps) {
  const [open, setOpen] = useState(defaultOpen)
  const hasHeader = lead || tail || title || actions || meta
  return (
    <section style={style} {...skinSurface('panel')} className={cn('panel-box relative flex min-h-0 flex-col overflow-hidden hover:border-l-accent', className)}>
      {loading && <span className="seven-pulse" />}
      {hasHeader && (
        <header
          className={cn('relative flex shrink-0 items-stretch border-b border-line/60', collapsible && 'cursor-pointer select-none')}
          onClick={collapsible ? () => setOpen(!open) : undefined}
        >
          {lead}
          <div className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-2.5 tablet:flex-wrap tablet:gap-2 tablet:px-2 tablet:py-1.5">
            {title && <h2 className="type-title text-ink tablet:min-w-0">{title}</h2>}
            {meta && <span className="font-ui text-[12px] text-dim">{meta}</span>}
            <div className="ml-auto flex items-center gap-2 tablet:flex-wrap tablet:justify-end" onClick={(e) => e.stopPropagation()}>
              {actions}
            </div>
            {collapsible && <ChevronDown className={cn('h-4 w-4 text-accent transition-transform', !open && '-rotate-180')} />}
          </div>
          {tail}
        </header>
      )}
      {open && <div className={cn('min-h-0 flex-1 p-3.5', bodyClassName)}>{children}</div>}
    </section>
  )
}
