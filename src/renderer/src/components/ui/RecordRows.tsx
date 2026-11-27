import { Fragment, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { MarkdownEditor } from '../data/MarkdownEditor'

export interface RowColumn<T> {
  key: keyof T & string
  label: string
  kind?: 'text' | 'number' | 'check' | 'long'
  width?: string
  placeholder?: string
}

export function RecordRows<T extends object>({ rows, columns, blank, onChange, addLabel = 'Add', add, detail, dense = false }: { rows: T[]; columns: RowColumn<T>[]; blank: () => T; onChange: (rows: T[]) => void; addLabel?: string; add?: ReactNode; detail?: (row: T) => ReactNode | null; dense?: boolean }) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const toggle = (i: number) => setOpen((s) => (s.has(i) ? new Set([...s].filter((x) => x !== i)) : new Set([...s, i])))
  const set = (i: number, key: keyof T, value: unknown) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)))
  const grid = { gridTemplateColumns: `${detail ? '1rem ' : ''}${columns.map((c) => c.width ?? (c.kind === 'check' ? '3rem' : c.kind === 'number' ? '4.5rem' : 'minmax(0,1fr)')).join(' ')} 1.75rem` }
  const cell = dense ? 'h-7 min-w-0 border border-transparent bg-transparent px-1.5 text-[13px] text-ink outline-none hover:border-line/40 focus:border-accent/60' : 'h-8 min-w-0 border border-line/40 tone-well-40 px-2 text-[13px] text-ink outline-none focus:border-accent/60'
  return (
    <div className="flex flex-col gap-1">
      {rows.length > 0 && (
        <div className="grid gap-1.5 font-label text-[10px] caps-14 text-faint" style={grid}>
          {detail && <span />}
          {columns.map((c) => (
            <span key={c.key} className={c.kind === 'check' ? 'text-center' : undefined}>
              {c.label}
            </span>
          ))}
        </div>
      )}
      {rows.map((row, i) => {
        const more = detail?.(row) ?? null
        const shown = more !== null && open.has(i)
        return (
          <Fragment key={i}>
            <div className="group grid items-start gap-1.5" style={grid}>
              {detail &&
                (more !== null ? (
                  <button title={shown ? 'Hide details' : 'Show details'} onClick={() => toggle(i)} className="mt-1.5 flex h-4 w-4 items-center justify-center text-faint hover:text-accent">
                    {shown ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                ) : (
                  <span />
                ))}
              {columns.map((c) => {
                const value = row[c.key] as unknown
                if (c.kind === 'check') return <input key={c.key} type="checkbox" checked={value === true} onChange={(e) => set(i, c.key, e.target.checked)} className="mx-auto mt-2 h-4 w-4 accent-[var(--color-accent)]" />
                if (c.kind === 'number') return <input key={c.key} type="number" value={Number(value) || 0} onChange={(e) => set(i, c.key, Math.round(Number(e.target.value)) || 0)} className={cn(cell, 'font-data')} />
                if (c.kind === 'long') return <MarkdownEditor key={c.key} compact value={String(value ?? '')} placeholder={c.placeholder} onValue={(text) => set(i, c.key, text)} className="min-w-0" />
                return <input key={c.key} value={String(value ?? '')} placeholder={c.placeholder} onChange={(e) => set(i, c.key, e.target.value)} className={cell} />
              })}
              <button title="Remove" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="mt-1.5 flex h-5 w-5 items-center justify-center text-faint opacity-0 hover:text-alert group-hover:opacity-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {shown && <div className="mb-1 ml-5">{more}</div>}
          </Fragment>
        )
      })}
      {add ?? (
        <button onClick={() => onChange([...rows, blank()])} className="mt-0.5 flex items-center gap-1.5 self-start border border-dashed border-line/50 px-2 py-1 text-[12px] text-dim hover:border-accent/70 hover:text-accent">
          <Plus className="h-3.5 w-3.5" />
          {addLabel}
        </button>
      )}
    </div>
  )
}
