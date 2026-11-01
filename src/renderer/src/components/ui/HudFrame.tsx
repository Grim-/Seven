import type { ReactNode } from 'react'
import { useNow } from '../../lib/useNow'
import { formatClock } from '../../lib/format'

const CORNERS = ['left-3.5 top-3.5 border-l border-t', 'right-3.5 top-3.5 border-r border-t', 'bottom-3.5 left-3.5 border-b border-l', 'bottom-3.5 right-3.5 border-b border-r']

export function HudFrame({ title, hint }: { title?: string; hint?: ReactNode }) {
  const now = useNow(15000)
  return (
    <>
      <div className="hud-scan pointer-events-none absolute inset-0" />
      <div className="hud-vignette pointer-events-none absolute inset-0" />
      {CORNERS.map((c) => (
        <span key={c} className={`pointer-events-none absolute h-[22px] w-[22px] border-line ${c}`} />
      ))}
      <div className="drag absolute inset-x-12 top-3 z-20 flex h-4 items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
        <span className="text-accent">//</span>
        <span className="text-dim">Seven</span>
        <span className="h-px flex-1 bg-gradient-to-r from-line to-transparent" />
        {title && <span className="max-w-[40%] truncate">{title}</span>}
        <span className="h-px flex-1 bg-gradient-to-l from-line to-transparent" />
        <span>{formatClock(now)}</span>
      </div>
      {hint && <div className="pointer-events-none absolute bottom-3 left-12 z-20 font-mono text-[9.5px] uppercase tracking-[0.2em] text-faint [&_b]:font-semibold [&_b]:text-accent-soft">{hint}</div>}
    </>
  )
}
