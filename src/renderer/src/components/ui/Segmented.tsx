import type { MouseEvent } from 'react'
import { cn } from '../../lib/cn'

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  marked = [],
  onMenu,
  wrap = false
}: {
  value: T
  options: { value: T; label: string; hint?: string }[]
  onChange: (v: T) => void
  marked?: T[]
  onMenu?: (e: MouseEvent, v: T) => void
  wrap?: boolean
}) {
  return (
    <div className={cn('flex border border-line/60', wrap && 'flex-wrap')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.hint}
          onClick={() => o.value !== value && onChange(o.value)}
          onContextMenu={onMenu ? (e) => onMenu(e, o.value) : undefined}
          className={cn('flex-1 px-3 py-1.5 text-[12px] transition-colors', wrap && 'flex-none', o.value === value ? 'bg-accent/15 text-ink shadow-[inset_0_-2px_0_var(--color-accent)]' : 'text-dim hover:bg-ink/[0.04] hover:text-ink')}
        >
          {o.label}
          {marked.includes(o.value) && <span className="ml-1 text-accent">•</span>}
        </button>
      ))}
    </div>
  )
}
