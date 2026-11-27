import type { RelationCategory, RelationshipEntry } from '@shared/relationships'
import { cn } from '../../lib/cn'
import { CATEGORY_UIS } from './styles'

export function CategoryChips({ items, value, onChange, hideEmpty = false }: { items: RelationshipEntry[]; value: RelationCategory | 'all'; onChange: (next: RelationCategory | 'all') => void; hideEmpty?: boolean }) {
  const count = (id: RelationCategory) => items.filter((i) => i.category === id).length
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange('all')}
        className={cn('border px-2 py-0.5 font-label text-[10px] caps-5 transition-colors', value === 'all' ? 'border-accent bg-accent/15 text-accent' : 'border-line/50 text-dim hover:border-line hover:text-ink')}
      >
        All ({items.length})
      </button>
      {CATEGORY_UIS.map(({ id, plural, Icon, chipClass }) => {
        const n = count(id)
        if (hideEmpty && n === 0) return null
        const on = value === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn('flex items-center gap-1 border px-2 py-0.5 font-label text-[10px] caps-5 transition-colors', on ? chipClass : 'border-line/40 text-dim hover:border-line hover:text-ink', n === 0 && !on && 'opacity-50')}
          >
            <Icon className="h-3 w-3" />
            {plural}
            {n > 0 && <span className="opacity-75">{n}</span>}
          </button>
        )
      })}
    </div>
  )
}
