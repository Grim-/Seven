import type { ReactNode } from 'react'
import { GripVertical, Plus, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { moved, useReorder } from './reorder'

export function TextCards<T = string>({ values, onChange, addLabel, empty, editor, blank = '' as T }: { values: T[]; onChange: (next: T[]) => void; addLabel: string; empty?: string; editor: (value: T, set: (next: T) => void, index: number) => ReactNode; blank?: T }) {
  const reorder = useReorder((from, to) => onChange(moved(values, from, to)))
  return (
    <div className="flex flex-col gap-2">
      {values.map((v, i) => (
        <div key={i} {...reorder.props(i)} className={cn('group flex gap-1.5 border border-line/40 tone-well-40 p-1.5', reorder.isOver(i) && 'border-t-2 border-t-accent')}>
          <span className="flex w-4 shrink-0 cursor-grab items-start justify-center pt-2 text-faint opacity-0 group-hover:opacity-100">
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">{editor(v, (next) => onChange(values.map((x, j) => (j === i ? next : x))), i)}</div>
          <button title="Remove" onClick={() => onChange(values.filter((_, j) => j !== i))} className="flex h-6 w-6 shrink-0 items-center justify-center text-dim opacity-0 hover:text-alert group-hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {!values.length && empty && <div className="text-[12.5px] text-faint">{empty}</div>}
      <button onClick={() => onChange([...values, blank])} className="flex items-center gap-1.5 self-start border border-dashed border-line/50 px-2.5 py-1 text-[12px] text-dim hover:border-accent/70 hover:text-accent">
        <Plus className="h-3.5 w-3.5" />
        {addLabel}
      </button>
    </div>
  )
}
