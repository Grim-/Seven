import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * Compact search field that auto-focuses when mounted/opened and collapses to a
 * small icon button when unfocused and empty. Pressing Escape blurs the input first
 * (handled cleanly with global two-stage Escape), collapsing it before a second
 * Escape closes the enclosing menu or modal.
 */
export function CollapsibleSearch({
  value,
  onChange,
  placeholder = 'Search…',
  autoFocus = true,
  className
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(autoFocus || Boolean(value))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && autoFocus) {
      inputRef.current?.focus()
    }
  }, [open, autoFocus])

  if (!open && !value) {
    return (
      <button
        type="button"
        title={placeholder}
        onClick={() => {
          setOpen(true)
          requestAnimationFrame(() => inputRef.current?.focus())
        }}
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center border border-line/60 tone-well-50 text-dim transition-colors hover:border-accent hover:text-ink cursor-pointer',
          className
        )}
      >
        <Search className="h-3.5 w-3.5" />
      </button>
    )
  }

  return (
    <div
      className={cn(
        'flex h-7 flex-1 items-center gap-1.5 border border-line/70 tone-well-60 px-2 focus-within:border-accent',
        className
      )}
    >
      <Search className="h-3.5 w-3.5 shrink-0 text-dim" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (!value.trim()) setOpen(false)
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent font-ui text-[11.5px] text-ink placeholder:text-faint focus:outline-none select-text"
      />
      {value && (
        <button
          type="button"
          title="Clear search"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
          className="text-faint hover:text-ink cursor-pointer"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
