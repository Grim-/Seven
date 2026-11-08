import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface GameTab {
  id: string
  label: string
  icon?: ReactNode
  keyHint?: string
}

const CORNERS = [
  '-left-px -top-px border-l-2 border-t-2',
  '-right-px -top-px border-r-2 border-t-2',
  '-bottom-px -left-px border-b-2 border-l-2',
  '-bottom-px -right-px border-b-2 border-r-2'
]

export function GameWindow({
  title,
  tabs,
  tab,
  onTab,
  onClose,
  side,
  children,
  className
}: {
  title: string
  tabs?: GameTab[]
  tab?: string
  onTab?: (id: string) => void
  onClose: () => void
  side?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'pointer-events-auto absolute left-1/2 top-[calc(50%-44px)] -translate-x-1/2 -translate-y-1/2 w-[1120px] max-w-[calc(100vw-32px)] h-[530px] max-h-[calc(100vh-140px)] z-30 flex flex-col border border-line-bright bg-[#080d12]/95 backdrop-blur-md shadow-[0_24px_64px_rgba(0,0,0,0.95)]',
        className
      )}
      onContextMenu={(e) => e.stopPropagation()}
    >
      {CORNERS.map((c) => (
        <span key={c} className={cn('pointer-events-none absolute h-3.5 w-3.5 border-accent', c)} />
      ))}

      {/* Header bar */}
      <div className="flex h-11 shrink-0 items-stretch border-b border-line/60 bg-black/60">
        <div className="flex items-center px-4 font-mono text-[11.5px] font-bold uppercase tracking-[0.2em] text-accent border-r border-line/40">
          {title}
        </div>
        {tabs?.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab?.(t.id)}
            className={cn(
              'flex items-center gap-2 border-r border-line/40 px-4 text-[12.5px] font-medium transition-all [&_svg]:h-4 [&_svg]:w-4',
              t.id === tab
                ? 'bg-accent/15 text-white shadow-[inset_0_-2px_0_var(--color-accent)] font-semibold'
                : 'text-dim hover:bg-white/[0.04] hover:text-white'
            )}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.keyHint && (
              <kbd className="border border-line/60 bg-black/50 px-1.5 py-0.5 font-mono text-[9.5px] text-faint">
                {t.keyHint}
              </kbd>
            )}
          </button>
        ))}
        <span className="flex-1" />
        <button
          type="button"
          title="Close (Esc)"
          onClick={onClose}
          className="flex w-11 items-center justify-center border-l border-line/40 text-dim transition-colors hover:bg-alert/15 hover:text-alert"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Viewport */}
      <div className="flex min-h-0 flex-1">
        {side && (
          <div className="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto border-r border-line/50 bg-black/40 p-3">
            {side}
          </div>
        )}
        <div className="min-h-0 min-w-0 flex-1 flex flex-col p-3 overflow-hidden">{children}</div>
      </div>
    </div>
  )
}
