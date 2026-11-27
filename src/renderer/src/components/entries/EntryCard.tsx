import { createContext, useContext, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export const InsideSlateContext = createContext(false)

export function EntryCard({ title, tag, aside, children, className }: { title: ReactNode; tag: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  const insideSlate = useContext(InsideSlateContext)
  if (insideSlate) {
    return (
      <div className={cn('flex flex-col gap-2.5', className)}>
        {aside && <div className="flex items-center justify-end gap-2 font-ui text-[10.5px] text-faint">{aside}</div>}
        {children}
      </div>
    )
  }
  return (
    <div className={cn('notch-sm border border-line border-l-2 border-l-accent tone-panel-85 backdrop-blur-[calc(var(--panel-blur)*1.5)] shadow-[0_14px_38px_color-mix(in_srgb,var(--color-shade)_85%,transparent)]', className)}>
      <div className="flex items-center gap-2 border-b border-line/40 px-3 py-2">
        <span className="min-w-0 truncate text-[13px] font-semibold caps-6 text-ink">{title}</span>
        <span className="shrink-0 border border-secondary/35 px-1.5 font-label text-[9.5px] font-semibold caps-14 text-secondary">{tag}</span>
        {aside && <span className="ml-auto flex shrink-0 items-center gap-2">{aside}</span>}
      </div>
      <div className="flex flex-col gap-2.5 px-3.5 py-3">{children}</div>
    </div>
  )
}

export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[12.5px]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="font-label text-[10.5px] caps-10 text-faint">{label}</dt>
          <dd className="m-0 min-w-0 break-words text-ink/90">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function BigStat({ value, label, className }: { value: ReactNode; label?: string; className?: string }) {
  return (
    <div className="flex flex-col">
      <span className={cn('font-ui text-[28px] font-bold leading-none text-accent', className)}>{value}</span>
      {label && <span className="mt-1 font-label text-[10px] caps-14 text-faint">{label}</span>}
    </div>
  )
}

export function Lines({ items }: { items: ReactNode[] }) {
  return (
    <div className="flex flex-col">
      {items.map((item, i) => (
        <div key={i} className="flex min-w-0 items-baseline gap-2 border-b border-ink/[0.04] py-1 text-[12.5px]">
          {item}
        </div>
      ))}
    </div>
  )
}

export function Loading() {
  return <div className="font-ui text-[11px] text-dim">Loading…</div>
}
