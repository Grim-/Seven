import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import type { WorkoutPageType } from '@shared/types'
import { showName } from '@shared/ids'
import { useData } from '../../store/data'
import { Button, Select } from '../ui'

export function usePagesOf(type: WorkoutPageType): { id: string; title: string }[] {
  return useData((s) => s.pages)
    .filter((p) => p.type === type)
    .map((p) => ({ id: p.id, title: showName(p.title) }))
    .sort((a, b) => a.title.localeCompare(b.title))
}

export function titleOf(pages: { id: string; title: string }[], id: string): string {
  return pages.find((p) => p.id === id)?.title ?? '(deleted)'
}

export function move<T>(list: T[], i: number, by: number): T[] {
  const j = i + by
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}


export function RowButtons({ onUp, onDown, onRemove }: { onUp: () => void; onDown: () => void; onRemove: () => void }) {
  return (
    <span className="ml-auto flex shrink-0 gap-0.5">
      <button title="Move up" onClick={onUp} className="flex h-6 w-6 items-center justify-center text-dim hover:text-ink">
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button title="Move down" onClick={onDown} className="flex h-6 w-6 items-center justify-center text-dim hover:text-ink">
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
      <button title="Remove" onClick={onRemove} className="flex h-6 w-6 items-center justify-center text-dim hover:text-alert">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  )
}

export function AddPicker({ label, options, onPick, onNew }: { label: string; options: { id: string; title: string }[]; onPick: (id: string) => void; onNew: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-64">
        <Select value="" options={[{ value: '', label }, ...options.map((o) => ({ value: o.id, label: o.title }))]} onChange={(v) => v && onPick(v)} className="h-8 text-[12.5px]" />
      </div>
      <Button size="sm" variant="ghost" icon={<Plus />} onClick={onNew}>
        New…
      </Button>
    </div>
  )
}
