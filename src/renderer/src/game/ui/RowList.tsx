import type { TooltipRow } from '@shared/game/core'
import { cn } from '../../lib/cn'

export function RowList({ rows, className }: { rows: TooltipRow[]; className?: string }) {
  if (!rows.length) return null
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      {rows.map((r, i) => (
        <div key={`${r.label}.${i}`} className="flex gap-3 text-[12px]">
          <span className="flex-1 text-dim">{r.label}</span>
          <span className="font-ui text-ink/90">{r.value}</span>
        </div>
      ))}
    </div>
  )
}
