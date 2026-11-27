import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { SuggestList, useSuggest } from './Suggest'
import { Pressable } from './Pressable'

export function InlineEdit({
  value,
  shown,
  onSave,
  placeholder = '—',
  suggestions,
  required = false,
  numeric = false,
  title,
  trailing,
  className,
  edit
}: {
  value: string
  shown?: ReactNode
  onSave: (next: string) => void
  placeholder?: string
  suggestions?: string[]
  required?: boolean
  numeric?: boolean
  title?: string
  trailing?: ReactNode
  className?: string
  edit?: (p: { draft: string; setDraft: (next: string) => void; commit: (text: string) => void; cancel: () => void }) => ReactNode
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
  const cancel = () => {
    open.current = false
    setDraft(value)
    setEditing(false)
  }
  if (!editing)
    return (
      <Pressable inline onClick={start} title={title} className={cn('group inline-flex min-w-0 max-w-full cursor-pointer items-baseline gap-1.5 border-b border-dashed border-transparent text-left hover:border-faint', className)}>
        <span className={cn('truncate', !value && 'text-faint')}>{shown ?? (value || placeholder)}</span>
        {trailing}
      </Pressable>
    )
  if (edit) return <span className="relative flex min-w-0 max-w-full flex-1">{edit({ draft, setDraft, commit, cancel })}</span>
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
          if (e.key === 'Escape') cancel()
        }}
        className={cn('min-w-0 max-w-full border-b border-accent bg-transparent outline-none placeholder:text-faint', className)}
      />
      <SuggestList options={options} pick={pick} onPick={commit} className="min-w-[14rem]" />
    </span>
  )
}
