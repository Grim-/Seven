import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { SuggestList, useSuggest } from './Suggest'

export function InlineEdit({
  value,
  onSave,
  placeholder = '—',
  suggestions,
  required = false,
  numeric = false,
  title,
  trailing,
  className
}: {
  value: string
  onSave: (next: string) => void
  placeholder?: string
  suggestions?: string[]
  required?: boolean
  numeric?: boolean
  title?: string
  trailing?: ReactNode
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const open = useRef(false)
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const { options, pick, current, move } = useSuggest(suggestions ?? [], editing ? draft : '')
  const start = () => {
    open.current = true
    setEditing(true)
  }
  const commit = (text: string) => {
    if (!open.current) return
    open.current = false
    setEditing(false)
    const next = text.trim()
    if ((next || !required) && next !== value) onSave(next)
    setDraft(value)
  }
  if (!editing)
    return (
      <button onClick={start} title={title} className={cn('group inline-flex min-w-0 max-w-full items-baseline gap-1.5 border-b border-dashed border-transparent text-left hover:border-faint', className)}>
        <span className={cn('truncate', !value && 'text-faint')}>{value || placeholder}</span>
        {trailing}
      </button>
    )
  return (
    <span className="relative inline-flex min-w-0 max-w-full">
      <input
        autoFocus
        value={draft}
        inputMode={numeric ? 'numeric' : undefined}
        size={Math.max(numeric ? 2 : 6, draft.length + 1, numeric ? 0 : Math.min(placeholder.length, 24))}
        placeholder={placeholder}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (move(e)) return
          if (e.key === 'Enter') commit(current && options.length ? current : draft)
          if (e.key === 'Escape') {
            open.current = false
            setDraft(value)
            setEditing(false)
          }
        }}
        className={cn('min-w-0 max-w-full border-b border-accent bg-transparent outline-none placeholder:text-faint', className)}
      />
      <SuggestList options={options} pick={pick} onPick={commit} className="min-w-[14rem]" />
    </span>
  )
}
