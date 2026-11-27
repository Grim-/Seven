import { GripVertical, Plus, X } from 'lucide-react'
import { askConfirm, moved, useReorder } from '../ui'
import { cn } from '../../lib/cn'
import type { Act } from './model'

export function ActList({ acts, selected, onSelect, onChange, onAdd }: { acts: Act[]; selected: number; onSelect: (i: number) => void; onChange: (acts: Act[]) => void; onAdd: () => void }) {
  const reorder = useReorder((from, to) => {
    onChange(moved(acts, from, to))
    onSelect(to)
  })
  return (
    <nav className="flex w-56 shrink-0 flex-col border-r border-line/40 pr-2">
      {acts.map((a, i) => (
        <div
          key={i}
          {...reorder.props(i)}
          onClick={() => onSelect(i)}
          className={cn('group flex cursor-pointer items-center gap-1.5 border-l-2 py-2 pl-1.5 pr-1', i === selected ? 'border-l-accent bg-accent/10' : 'border-l-transparent hover:bg-ink/[0.03]', reorder.isOver(i) && 'border-t-2 border-t-accent')}
        >
          <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-faint opacity-0 group-hover:opacity-100" />
          <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-line/60 font-ui text-[11px] text-accent-soft">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{a.name || 'Untitled act'}</span>
          <button
            title="Remove this act"
            onClick={(e) => {
              e.stopPropagation()
              askConfirm(`Remove ${a.name || `act ${i + 1}`}?`, 'Its beat, ending and turns are removed from the template.', 'Remove', () => {
                onChange(acts.filter((_, j) => j !== i))
                onSelect(Math.max(0, Math.min(selected, acts.length - 2)))
              })
            }}
            className="flex h-6 w-6 shrink-0 items-center justify-center text-dim opacity-0 hover:text-alert group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button onClick={onAdd} className="mt-1 flex items-center gap-1.5 border border-dashed border-line/50 px-2.5 py-1.5 text-[12px] text-dim hover:border-accent/70 hover:text-accent">
        <Plus className="h-3.5 w-3.5" /> Add an act
      </button>
    </nav>
  )
}
