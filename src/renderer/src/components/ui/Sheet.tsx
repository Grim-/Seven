import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useEscapeLayer } from '../../lib/escape'

export function Sheet({
  open,
  onClose,
  title,
  footer,
  bodyClassName,
  children
}: {
  open: boolean
  onClose: () => void
  title: string
  footer?: ReactNode
  bodyClassName?: string
  children: ReactNode
}) {
  useEscapeLayer(open, onClose)
  if (!open) return null
  return createPortal(
    <>
      <div data-layer className="fixed inset-x-0 top-0 z-[90] tablet:bottom-[var(--nav-h,3rem)] tablet:bg-scrim/50" onClick={onClose} />
      <section
        data-layer
        role="dialog"
        aria-label={title}
        className="fixed z-[95] flex flex-col border border-line tone-bg-95 font-ui shadow-[0_0_30px_color-mix(in_srgb,var(--color-shade)_85%,transparent)] backdrop-blur-[calc(var(--panel-blur)*1.5)] tablet:top-2 tablet:right-2 tablet:bottom-[calc(var(--nav-h,3rem)+0.5rem)] tablet:w-[26rem] tablet:max-w-[calc(100%-1rem)] phone:inset-x-0 phone:top-0 phone:bottom-[var(--nav-h,3rem)] phone:w-auto phone:max-w-none phone:border-x-0 phone:border-t-0 phone:pt-[env(safe-area-inset-top)]"
      >
        <header className="flex h-12 shrink-0 items-center border-b border-line/50 pl-3">
          <h2 className="min-w-0 flex-1 truncate text-[11px] font-semibold caps-16 text-accent-soft">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="flex h-12 w-12 items-center justify-center text-dim hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className={cn('min-h-0 flex-1 overscroll-contain', bodyClassName ?? 'overflow-y-auto')}>{children}</div>
        {footer && <footer className="shrink-0 border-t border-line/50 p-2">{footer}</footer>}
      </section>
    </>,
    document.body
  )
}
