import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'

export function useSuggest(suggestions: string[], query: string, exclude: string[] = [], limit = 8) {
  const [pick, setPick] = useState(0)
  const q = query.trim().toLowerCase()
  const skip = exclude.join('\n')
  const options = useMemo(() => {
    const out = new Set(skip ? skip.split('\n') : [])
    const pool = [...new Set(suggestions)].filter((s) => !out.has(s) && (!q || s.toLowerCase().includes(q)))
    return [...pool.filter((s) => s.toLowerCase().startsWith(q)), ...pool.filter((s) => !s.toLowerCase().startsWith(q))].slice(0, limit)
  }, [suggestions, skip, q, limit])
  useEffect(() => setPick(0), [q])
  const move = (e: KeyboardEvent): boolean => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return false
    e.preventDefault()
    setPick((p) => (e.key === 'ArrowDown' ? Math.min(options.length - 1, p + 1) : Math.max(0, p - 1)))
    return true
  }
  return { options, pick, current: options[pick] as string | undefined, move }
}

export function SuggestList({ options, pick, onPick, prefix = '', className }: { options: string[]; pick: number; onPick: (option: string) => void; prefix?: string; className?: string }) {
  if (!options.length) return null
  return (
    <div className={cn('absolute left-0 top-full z-30 mt-0.5 border border-line tone-panel-95 py-0.5 shadow-lg', className)}>
      {options.map((o, i) => (
        <button
          key={o}
          onMouseDown={(e) => {
            e.preventDefault()
            onPick(o)
          }}
          className={cn('block w-full truncate px-2.5 py-1 text-left font-ui text-[12px]', i === pick ? 'bg-accent/15 text-ink' : 'text-dim hover:text-ink')}
        >
          {prefix}
          {o}
        </button>
      ))}
    </div>
  )
}
