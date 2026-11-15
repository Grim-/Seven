import { useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDownAZ, Check, CopyMinus, GripVertical, ListPlus, Text, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { moved, useReorder, type ReorderProps } from './reorder'

function Row({ value, index, duplicate, render, mono, drag, dragOver, onCommit, onRemove }: { value: string; index: number; duplicate: boolean; render?: (value: string) => ReactNode; mono?: boolean; drag: ReorderProps; dragOver: boolean; onCommit: (next: string) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const commit = () => {
    setEditing(false)
    if (draft !== value) onCommit(draft)
  }
  return (
    <div
      {...(editing ? {} : drag)}
      className={cn('group flex min-h-8 items-center gap-1.5 border-b border-l-2 border-b-line/20 pr-1', duplicate ? 'border-l-accent/70 bg-accent/[0.04]' : 'border-l-transparent', dragOver && 'border-t-2 border-t-accent')}
    >
      <span className={cn('flex h-6 w-4 shrink-0 items-center justify-center text-faint', drag.draggable ? 'cursor-grab opacity-0 group-hover:opacity-100' : 'opacity-0')}>
        <GripVertical className="h-3.5 w-3.5" />
      </span>
      <span className="w-8 shrink-0 text-right font-mono text-[10.5px] text-faint">{index + 1}</span>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setDraft(value)
              setEditing(false)
            }
          }}
          className={cn('h-7 min-w-0 flex-1 border border-accent/60 bg-black px-2 text-[13px] text-white outline-none', mono && 'font-mono text-[12.5px]')}
        />
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setDraft(value)
            setEditing(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setDraft(value)
              setEditing(true)
            }
          }}
          title={duplicate ? 'This value is in the list more than once' : 'Click to edit'}
          className={cn('min-w-0 flex-1 truncate py-1 text-left text-[13px] text-white/90 hover:text-white cursor-text', mono && 'font-mono text-[12.5px]')}
        >
          {render ? render(value) : value}
        </div>
      )}
      <button title="Remove" onClick={onRemove} className="flex h-6 w-6 shrink-0 items-center justify-center text-dim opacity-0 hover:text-alert group-hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function ListEditor({
  values,
  onChange,
  placeholder = 'Add a value',
  render,
  mono = false,
  label = 'values',
  toolbar,
  addActions
}: {
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  render?: (value: string) => ReactNode
  mono?: boolean
  label?: string
  toolbar?: ReactNode
  addActions?: ReactNode
}) {
  const [adding, setAdding] = useState('')
  const [filter, setFilter] = useState('')
  const [asText, setAsText] = useState(false)
  const [text, setText] = useState('')
  const reorder = useReorder((from, to) => onChange(moved(values, from, to)))
  const addBox = useRef<HTMLInputElement>(null)
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const v of values) m.set(v.trim().toLowerCase(), (m.get(v.trim().toLowerCase()) ?? 0) + 1)
    return m
  }, [values])
  const dupes = [...counts.values()].some((n) => n > 1)
  const q = filter.trim().toLowerCase()
  const shown = values.map((v, i) => ({ v, i })).filter(({ v }) => !q || v.toLowerCase().includes(q))
  const add = (raw: string) => {
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length) onChange([...values, ...lines])
    setAdding('')
  }
  const tool = 'flex h-7 items-center gap-1.5 px-2 text-[11.5px] text-dim hover:text-white'
  return (
    <div className="flex min-h-0 flex-1 flex-col border border-line/50 bg-black/40">
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-line/40 px-2 py-1">
        <span className="mr-1 font-mono text-[11px] text-white">
          {values.length} {label}
        </span>
        {!asText && values.length > 8 && (
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setFilter('')}
            placeholder="Filter"
            className="h-6 w-36 border border-line/40 bg-transparent px-2 text-[12px] text-white outline-none placeholder:text-faint focus:border-accent/50"
          />
        )}
        <span className="flex-1" />
        {!asText && dupes && (
          <button className={tool} title="Keep the first of each repeated value" onClick={() => onChange(values.filter((v, i) => values.findIndex((x) => x.trim().toLowerCase() === v.trim().toLowerCase()) === i))}>
            <CopyMinus className="h-3.5 w-3.5" /> Remove repeats
          </button>
        )}
        {!asText && values.length > 1 && (
          <button className={tool} onClick={() => onChange([...values].sort((a, b) => a.localeCompare(b)))}>
            <ArrowDownAZ className="h-3.5 w-3.5" /> Sort
          </button>
        )}
        {!asText && toolbar}
        <button
          className={cn(tool, asText && 'text-accent')}
          onClick={() => {
            if (asText) onChange(text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))
            else setText(values.join('\n'))
            setAsText(!asText)
          }}
        >
          {asText ? <Check className="h-3.5 w-3.5" /> : <Text className="h-3.5 w-3.5" />}
          {asText ? 'Done' : 'Edit as text'}
        </button>
      </div>
      {asText ? (
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className={cn('min-h-0 flex-1 resize-none bg-transparent p-2.5 text-[13px] leading-relaxed text-white outline-none', mono && 'font-mono text-[12.5px]')}
        />
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {shown.map(({ v, i }) => (
              <Row
                key={`${i}:${v}`}
                value={v}
                index={i}
                mono={mono}
                render={render}
                duplicate={(counts.get(v.trim().toLowerCase()) ?? 0) > 1}
                drag={reorder.props(i, !q)}
                dragOver={reorder.isOver(i)}
                onCommit={(next) => onChange(next.trim() ? values.map((x, j) => (j === i ? next.trim() : x)) : values.filter((_, j) => j !== i))}
                onRemove={() => onChange(values.filter((_, j) => j !== i))}
              />
            ))}
            {!values.length && <div className="px-3 py-2 text-[12.5px] text-faint">Nothing yet. Type below, or paste a list with one per line.</div>}
            {q && !shown.length && <div className="px-3 py-2 text-[12.5px] text-faint">Nothing matches "{filter.trim()}".</div>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 border-t border-line/40 px-2 py-1.5">
            <ListPlus className="h-4 w-4 shrink-0 text-accent-soft" />
            <input
              ref={addBox}
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  add(adding)
                }
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text')
                if (/\n/.test(pasted)) {
                  e.preventDefault()
                  add(`${adding}${pasted}`)
                }
              }}
              placeholder={`${placeholder} (Enter adds; pasting several lines adds each)`}
              className={cn('h-7 min-w-0 flex-1 bg-transparent px-1 text-[13px] text-white outline-none placeholder:text-dim/60', mono && 'font-mono text-[12.5px]')}
            />
            {addActions}
          </div>
        </>
      )}
    </div>
  )
}
