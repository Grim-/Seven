import { useMemo, useState, type KeyboardEvent } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Popover } from './Popover'

export interface BrowseOption {
  value: string
  label: string
  group: string
  note?: string
}

export function BrowseList({ options, value, onPick }: { options: BrowseOption[]; value: string | null; onPick: (value: string) => void }) {
  const [query, setQuery] = useState('')
  const [at, setAt] = useState(0)
  const q = query.trim().toLowerCase()
  const shown = useMemo(() => options.filter((o) => !q || `${o.label} ${o.group} ${o.note ?? ''}`.toLowerCase().includes(q)), [options, q])
  const groups = [...new Set(shown.map((o) => o.group))]
  const ordered = groups.flatMap((g) => shown.filter((o) => o.group === g))
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setAt((n) => Math.max(0, Math.min(ordered.length - 1, n + (e.key === 'ArrowDown' ? 1 : -1))))
    }
    if (e.key === 'Enter' && ordered[at]) onPick(ordered[at].value)
  }
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <input
        autoFocus
        value={query}
        placeholder="Filter"
        onChange={(e) => {
          setQuery(e.target.value)
          setAt(0)
        }}
        onKeyDown={keys}
        className="h-8 border border-line/60 bg-black/40 px-2.5 text-[13px] text-white outline-none placeholder:text-faint focus:border-accent/70"
      />
      <div className="max-h-[60vh] min-h-0 overflow-y-auto">
        {groups.map((group) => (
          <div key={group} className="flex flex-col">
            <span className="sticky top-0 bg-black/95 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-accent-soft">{group}</span>
            {shown
              .filter((o) => o.group === group)
              .map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onPick(o.value)}
                  className={cn('flex flex-col px-2.5 py-1.5 text-left hover:bg-cyan/[0.08]', ordered[at]?.value === o.value && 'bg-accent/15', o.value === value && 'border-l-2 border-l-cyan')}
                >
                  <span className="truncate text-[13px] text-white">{o.label}</span>
                  {o.note && <span className="truncate text-[11.5px] text-dim">{o.note}</span>}
                </button>
              ))}
          </div>
        ))}
        {!shown.length && <span className="block px-2.5 py-2 text-[12.5px] text-dim">Nothing matches.</span>}
      </div>
    </div>
  )
}

export function BrowsePick({ value, options, placeholder, onChange, className }: { value: string | null; options: BrowseOption[]; placeholder: string; onChange: (value: string | null) => void; className?: string }) {
  const chosen = options.find((o) => o.value === value)
  return (
    <div className={cn('flex min-w-0 items-stretch', className)}>
      <Popover
        align="start"
        className="w-[min(30rem,92vw)] p-3"
        rootClassName="min-w-0 flex-1"
        triggerClassName="flex h-full min-h-8 w-full min-w-0 items-center gap-2 border border-line/60 bg-black/40 px-2.5 text-left text-[13px] hover:border-accent/70"
        trigger={
          <>
            <span className={cn('min-w-0 flex-1 truncate', chosen ? 'text-white' : 'text-faint')}>{chosen?.label ?? placeholder}</span>
            {chosen && <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-dim">{chosen.group}</span>}
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-dim" />
          </>
        }
      >
        {(close) => (
          <BrowseList
            options={options}
            value={value}
            onPick={(next) => {
              onChange(next)
              close()
            }}
          />
        )}
      </Popover>
      {chosen && (
        <button type="button" title="Clear" onClick={() => onChange(null)} className="ml-1 shrink-0 px-1 text-faint hover:text-white">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
