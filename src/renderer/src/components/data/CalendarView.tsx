import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CollectionRecord } from '@shared/types'
import { Button } from '../ui'
import { cn } from '../../lib/cn'
import type { BodyProps } from './CollectionView'
import { checkField, primaryField } from './fields'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function key(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function CalendarBody({ page, records, options, compact, onOpen }: BodyProps) {
  const dateField =
    (typeof options.dateField === 'string' ? page.fields.find((f) => f.name === options.dateField && f.type === 'date') : undefined) ??
    page.fields.find((f) => f.type === 'date')
  const primary = primaryField(page)
  const check = checkField(page)
  const today = new Date()
  const [month, setMonth] = useState({ y: today.getFullYear(), m: today.getMonth() })

  const byDay = useMemo(() => {
    const map = new Map<string, CollectionRecord[]>()
    if (!dateField) return map
    for (const r of records) {
      const value = r.values[dateField.name]
      if (typeof value !== 'string') continue
      const day = value.slice(0, 10)
      map.set(day, [...(map.get(day) ?? []), r])
    }
    return map
  }, [records, dateField])

  if (!dateField) return <div className="p-2 text-[12.5px] text-dim">A calendar needs a date field. This page has none.</div>

  const first = new Date(month.y, month.m, 1)
  const offset = (first.getDay() + 6) % 7
  const daysIn = new Date(month.y, month.m + 1, 0).getDate()
  const cells = Math.ceil((offset + daysIn) / 7) * 7
  const todayKey = key(today.getFullYear(), today.getMonth(), today.getDate())
  const shift = (n: number) => setMonth((c) => {
    const d = new Date(c.y, c.m + n, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const max = compact ? 2 : 3

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-white">
          {first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => shift(-1)} title="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMonth({ y: today.getFullYear(), m: today.getMonth() })}>
            Today
          </Button>
          <Button size="sm" variant="ghost" onClick={() => shift(1)} title="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px font-mono text-[10px] uppercase tracking-wider text-faint">
        {DAYS.map((d) => (
          <div key={d} className="px-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-px bg-line/20">
        {Array.from({ length: cells }, (_, i) => {
          const day = i - offset + 1
          const inMonth = day >= 1 && day <= daysIn
          const k = inMonth ? key(month.y, month.m, day) : ''
          const items = inMonth ? (byDay.get(k) ?? []) : []
          return (
            <div key={i} className={cn('flex min-h-14 flex-col gap-0.5 bg-bg p-1', !inMonth && 'bg-black/60')}>
              {inMonth && (
                <span className={cn('font-mono text-[10.5px]', k === todayKey ? 'font-bold text-accent' : 'text-dim')}>{day}</span>
              )}
              {items.slice(0, max).map((r) => (
                <button
                  key={r.id}
                  onClick={() => onOpen(r)}
                  className={cn(
                    'truncate border-l-2 bg-accent/10 px-1 text-left text-[11px] text-white hover:bg-accent/20',
                    check && r.values[check.name] === true ? 'border-ok/70 line-through opacity-60' : 'border-accent'
                  )}
                >
                  {String(r.values[primary.name] ?? r.id)}
                </button>
              ))}
              {items.length > max && <span className="font-mono text-[10px] text-faint">+{items.length - max} more</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
