import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'

export function CardSection({ label, open: startOpen = false, children }: { label: string; open?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(startOpen)
  return (
    <div className="flex flex-col border-t border-white/10 pt-1 text-[0.82em]">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
        className="flex items-center gap-1 self-start font-mono text-[0.85em] font-bold uppercase tracking-[0.12em] text-[var(--c,var(--color-accent))] hover:text-white"
      >
        <ChevronRight className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} />
        {label}
      </button>
      {open && <div className="pt-1 text-white/85">{children}</div>}
    </div>
  )
}
