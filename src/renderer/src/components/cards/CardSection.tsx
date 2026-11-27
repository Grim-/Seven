import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'

export function CardSection({ label, open: startOpen = false, children }: { label: string; open?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(startOpen)
  return (
    <div className="flex flex-col border-t border-ink/12 pt-[0.65em] text-[0.9em]">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
        className="flex items-center gap-[0.35em] self-start font-label text-[0.86em] font-bold caps-12 text-[var(--c,var(--color-accent))] hover:text-ink"
      >
        <ChevronRight className={cn('h-[1em] w-[1em] shrink-0 transition-transform', open && 'rotate-90')} />
        {label}
      </button>
      {open && <div className="pt-[0.55em] text-ink/85">{children}</div>}
    </div>
  )
}
