import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button, SearchBox } from '../ui'
import { cn } from '../../lib/cn'

export interface SavedItem {
  id: string
  name: string
  sub: string
  tags: string[]
}

export function SavedList({ items, current, onPick, onNew, newLabel, placeholder }: { items: SavedItem[]; current: string | null; onPick: (id: string) => void; onNew: () => void; newLabel: string; placeholder: string }) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const shown = items.filter((i) => !needle || i.name.toLowerCase().includes(needle) || i.sub.toLowerCase().includes(needle) || i.tags.some((t) => t.includes(needle)))
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-line/60 bg-ink/[0.02]">
      <div className="border-b border-line/60 p-3">
        <SearchBox value={q} onChange={setQ} placeholder={placeholder} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.map((i) => (
          <button key={i.id} type="button" onClick={() => onPick(i.id)} className={cn('flex w-full flex-col gap-0.5 border-b border-l-2 border-b-line/30 px-3 py-2.5 text-left', i.id === current ? 'border-l-accent bg-accent/10' : 'border-l-transparent hover:bg-ink/[0.04]')}>
            <span className="text-[13.5px] font-semibold text-ink">{i.name}</span>
            <span className="truncate text-[12px] text-dim">{i.sub}</span>
          </button>
        ))}
        {!shown.length && <div className="p-3 text-[12px] text-dim">{items.length ? 'Nothing matches.' : 'Nothing saved yet.'}</div>}
      </div>
      <div className="border-t border-line/60 p-3">
        <Button size="sm" icon={<Plus />} onClick={onNew} className="w-full">
          {newLabel}
        </Button>
      </div>
    </aside>
  )
}
