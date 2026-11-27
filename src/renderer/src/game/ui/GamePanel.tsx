import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Eyebrow } from '../../components/ui'
import { cn } from '../../lib/cn'

export function GamePanel({
  title,
  aside,
  action,
  collapsible = true,
  defaultOpen = true,
  className,
  bodyClassName,
  children
}: {
  title: string
  aside?: ReactNode
  action?: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  className?: string
  bodyClassName?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const showBody = !collapsible || open

  return (
    <section className={cn('flex min-w-0 flex-col border border-line/45 bg-ink/[0.015]', className)}>
      <header className={cn('flex min-h-7 items-center gap-2 tone-well-40 px-2.5', showBody && 'border-b border-line/35')}>
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left transition-colors hover:text-ink"
          >
            {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-dim" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-dim" />}
            <Eyebrow>{title}</Eyebrow>
            {aside && <span className="truncate font-ui text-[11px] text-dim">{aside}</span>}
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2 py-1">
            <Eyebrow>{title}</Eyebrow>
            {aside && <span className="truncate font-ui text-[11px] text-dim">{aside}</span>}
          </div>
        )}
        {action && <span className="ml-auto flex shrink-0 items-center gap-1.5">{action}</span>}
      </header>
      {showBody && <div className={cn('flex flex-col gap-1.5 p-2.5', bodyClassName)}>{children}</div>}
    </section>
  )
}
