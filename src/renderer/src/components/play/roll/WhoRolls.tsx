import { useState } from 'react'
import { Search } from 'lucide-react'
import { showName } from '@shared/ids'
import { signed } from '@shared/dnd'
import { Input } from '../../ui'
import { SheetPortrait } from '../../data/SheetPortrait'
import { cn } from '../../../lib/cn'

export interface Roller {
  sheet: string
  name: string
  image: string | null
  bonus: number | null
  note?: string
  priority?: number
}

export function WhoRolls({
  label,
  people,
  value,
  onPick,
  locked = false,
  empty = 'No characters found.',
  searchable = true
}: {
  label: string
  people: Roller[]
  value: string | null
  onPick: (sheet: string) => void
  locked?: boolean
  empty?: string
  searchable?: boolean
}) {
  const [filter, setFilter] = useState('')
  const q = filter.trim().toLowerCase()

  const sorted = [...people].sort((a, b) => {
    const pA = a.priority ?? 2
    const pB = b.priority ?? 2
    if (pA !== pB) return pA - pB
    const aEligible = a.bonus !== null
    const bEligible = b.bonus !== null
    if (aEligible !== bEligible) return aEligible ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  const filtered = q
    ? sorted.filter((p) => p.name.toLowerCase().includes(q) || (p.note && p.note.toLowerCase().includes(q)))
    : sorted

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] text-dim">{label}</span>
        {searchable && people.length > 4 && (
          <div className="relative w-36">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search..."
              className="h-6 pl-6 text-[11px]"
            />
            <Search className="pointer-events-none absolute left-1.5 top-1.5 h-3 w-3 text-dim" />
          </div>
        )}
      </div>
      {!filtered.length ? (
        <span className="font-mono text-[12px] text-dim">{empty}</span>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-1.5">
          {filtered.map((p) => {
            const cannotMake = p.bonus === null
            const disabled = locked || cannotMake
            const isPicked = p.sheet === value
            return (
              <button
                key={p.sheet}
                type="button"
                disabled={disabled}
                onClick={() => onPick(p.sheet)}
                title={cannotMake ? 'This character cannot make this check' : undefined}
                className={cn(
                  'flex items-center gap-2 border px-2 py-1.5 text-left transition-colors',
                  isPicked ? 'border-accent bg-accent/[0.08]' : 'border-line/50 hover:border-accent/60',
                  disabled && !isPicked && 'cursor-not-allowed opacity-40 hover:border-line/50'
                )}
              >
                <SheetPortrait image={p.image} className="h-8 w-8 shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] text-white">{showName(p.name)}</span>
                  <span className="truncate text-[11px] text-dim">{cannotMake ? 'Cannot make check' : (p.note ?? '')}</span>
                </span>
                <span className="font-mono text-[14px] font-bold text-white">{cannotMake ? '—' : signed(p.bonus!)}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
