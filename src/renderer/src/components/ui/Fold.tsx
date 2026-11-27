import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'

export function Fold({ label, count, note, defaultOpen = false, children }: { label: string; count?: number; note?: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="flex flex-col">
      <button type="button" onClick={() => setOpen(!open)} className="setting-row flex w-full items-center gap-2 text-left text-[12.5px] text-ink/75 hover:text-ink">
        <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-accent transition-transform', open && 'rotate-90')} />
        <span className="flex-1">{label}</span>
        {note && <span className="truncate text-[11.5px] text-faint">{note}</span>}
        {count !== undefined && <span className="font-data text-[10.5px] text-faint">{count}</span>}
      </button>
      {open && <div className="flex flex-col">{children}</div>}
    </div>
  )
}
