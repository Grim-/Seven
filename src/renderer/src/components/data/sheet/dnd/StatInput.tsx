import type { ReactNode } from 'react'
import { InlineNumber } from '../../../ui'

export function StatInput({ label, value, onValue, sub, min, max, children }: { label: string; value?: number | string; onValue?: (n: number) => void; sub?: ReactNode; min?: number; max?: number; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-0.5 border-l border-line/30 px-3 py-2">
      <span className="truncate font-label text-[10px] font-bold caps-16 text-accent-soft">{label}</span>
      <div className="flex items-baseline gap-1.5 font-ui text-[22px] font-bold leading-tight text-ink">
        {children ?? (onValue && typeof value === 'number' ? <InlineNumber value={value} min={min} max={max} onSave={onValue} /> : <span className="text-secondary-ink">{value}</span>)}
        {sub && <span className="truncate text-[12px] font-normal text-dim">{sub}</span>}
      </div>
    </div>
  )
}
