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

export function BrowseList({
  options,
  value,
  onPick,
  onClear,
  clearLabel = 'None',
  allowCustom = false,
  placeholder = 'Filter'
}: {
  options: BrowseOption[]
  value: string | null
  onPick: (value: string) => void
  onClear?: () => void
  clearLabel?: string
  allowCustom?: boolean
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [at, setAt] = useState(0)
  const trimmed = query.trim()
  const q = trimmed.toLowerCase()
  const shown = useMemo(
    () => options.filter((o) => !q || `${o.value} ${o.label} ${o.group} ${o.note ?? ''}`.toLowerCase().includes(q)),
    [options, q]
  )
  const showClear = Boolean(onClear && (!q || `${clearLabel} none clear reset all`.toLowerCase().includes(q)))
  const exactMatch = Boolean(trimmed && options.some((o) => o.value.toLowerCase() === q || o.label.toLowerCase() === q))
  const canUseCustom = allowCustom && Boolean(trimmed) && !exactMatch
  const groups = [...new Set(shown.map((o) => o.group))]
  const ordered = groups.flatMap((g) => shown.filter((o) => o.group === g))
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setAt((n) => Math.max(0, Math.min(ordered.length - 1, n + (e.key === 'ArrowDown' ? 1 : -1))))
    }
    if (e.key === 'Enter') {
      const picked = ordered[at]
      if (picked) {
        if (onClear && picked.value === value) onClear()
        else onPick(picked.value)
      } else if (canUseCustom) {
        onPick(trimmed)
      }
    }
  }
  const selectOption = (opt: BrowseOption) => {
    if (onClear && opt.value === value) onClear()
    else onPick(opt.value)
  }
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <input
        autoFocus
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value)
          setAt(0)
        }}
        onKeyDown={keys}
        className="h-8 border border-line/60 tone-well-40 px-2.5 text-[13px] text-ink outline-none placeholder:text-faint focus:border-accent/70"
      />
      <div className="max-h-[60vh] min-h-0 overflow-y-auto">
        {showClear && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="mb-1 flex w-full items-center justify-between border-b border-line/50 px-2.5 py-1.5 text-left text-[12.5px] text-dim hover:bg-secondary-ink/[0.08] hover:text-ink"
          >
            <span className="truncate">{clearLabel}</span>
            <span className="shrink-0 font-label text-[10px] caps-12 text-faint">Clear</span>
          </button>
        )}
        {canUseCustom && (
          <button
            type="button"
            onClick={() => onPick(trimmed)}
            className="mb-1 flex w-full items-center justify-between border border-dashed border-accent/50 bg-accent/10 px-2.5 py-1.5 text-left font-ui text-[12px] text-accent hover:bg-accent/20"
          >
            <span>Use custom &ldquo;{trimmed}&rdquo;</span>
          </button>
        )}
        {groups.map((group) => (
          <div key={group} className="flex flex-col">
            <span className="sticky top-0 tone-panel-95 py-1 font-label text-[9.5px] font-bold caps-16 text-accent-soft">{group}</span>
            {shown
              .filter((o) => o.group === group)
              .map((o) => {
                const selected = o.value === value
                return (
                  <button
                    key={`${group}:${o.value}`}
                    type="button"
                    onClick={() => selectOption(o)}
                    className={cn(
                      'flex flex-col px-2.5 py-1.5 text-left hover:bg-secondary-ink/[0.08]',
                      ordered[at]?.value === o.value && 'bg-accent/15',
                      selected && 'border-l-2 border-l-secondary-ink'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] text-ink">{o.label}</span>
                      {selected && onClear && (
                        <span className="shrink-0 font-label text-[10px] caps-12 text-secondary-ink">Unselect</span>
                      )}
                    </div>
                    {o.note && <span className="truncate text-[11.5px] text-dim">{o.note}</span>}
                  </button>
                )
              })}
          </div>
        ))}
        {!shown.length && !canUseCustom && !showClear && <span className="block px-2.5 py-2 text-[12.5px] text-dim">Nothing matches.</span>}
      </div>
    </div>
  )
}

export function BrowsePick({
  value,
  options,
  placeholder,
  onChange,
  allowCustom = false,
  clearable = true,
  showGroup = false,
  className
}: {
  value: string | null
  options: BrowseOption[]
  placeholder: string
  onChange: (value: string | null) => void
  allowCustom?: boolean
  clearable?: boolean
  showGroup?: boolean
  className?: string
}) {
  const chosen = options.find((o) => o.value === value)
  const displayLabel = chosen?.label ?? (allowCustom && value ? value : placeholder)
  const hasValue = Boolean(chosen || (allowCustom && value))
  return (
    <div className={cn('flex min-w-0 items-stretch', className)}>
      <Popover
        align="start"
        className="w-[min(30rem,92vw)] p-3"
        rootClassName="min-w-0 flex-1"
        triggerClassName="flex h-full min-h-8 w-full min-w-0 items-center gap-2 border border-line/60 tone-well-40 px-2.5 text-left text-[13px] hover:border-accent/70"
        trigger={
          <>
            <span title={displayLabel} className={cn('min-w-0 flex-1 truncate', hasValue ? 'text-ink' : 'text-faint')}>{displayLabel}</span>
            {showGroup && chosen ? (
              <span className="shrink-0 font-label text-[10px] caps-12 text-dim">{chosen.group}</span>
            ) : (
              !chosen && allowCustom && value && <span className="shrink-0 font-label text-[10px] caps-12 text-accent">Custom</span>
            )}
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-dim" />
          </>
        }
      >
        {(close) => (
          <BrowseList
            options={options}
            value={value}
            allowCustom={allowCustom}
            placeholder={allowCustom ? 'Filter or type custom…' : 'Filter'}
            clearLabel={placeholder}
            onClear={
              clearable && hasValue
                ? () => {
                    onChange(null)
                    close()
                  }
                : undefined
            }
            onPick={(next) => {
              onChange(next)
              close()
            }}
          />
        )}
      </Popover>
      {hasValue && clearable && (
        <button type="button" title="Clear" onClick={() => onChange(null)} className="ml-1 shrink-0 px-1 text-faint hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
