import type { ReactNode } from 'react'
import type { WorkoutLogRow } from '@shared/types'
import { Eyebrow } from '../../ui'
import { agoText, dayLabel, streakWeeks, trainedDays, weekStart, weekdayOf } from '../progress/stats'

function Stat({ label, value, sub, gold = false }: { label: string; value: string; sub?: string; gold?: boolean }) {
  return (
    <div className="flex flex-col">
      <Eyebrow className="text-[10px]">{label}</Eyebrow>
      <span className={gold ? 'font-ui text-[20px] font-semibold leading-tight text-accent' : 'font-ui text-[20px] font-semibold leading-tight text-ink'}>{value}</span>
      {sub && <span className="text-[11.5px] text-faint">{sub}</span>}
    </div>
  )
}

export function TrainingStrip({ rows, today, nav }: { rows: WorkoutLogRow[]; today: string; nav: ReactNode }) {
  const days = trainedDays(rows)
  const last = days.filter((d) => d <= today).pop() ?? null
  const week = days.filter((d) => d >= weekStart(today) && d <= today)
  const month = days.filter((d) => d.slice(0, 7) === today.slice(0, 7) && d <= today)
  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-2 border border-line/50 tone-panel-50 px-4 py-2.5">
      <Stat label="Last trained" value={last ? dayLabel(last) : 'Never'} sub={last ? agoText(last, today) : undefined} gold />
      <Stat label="This week" value={`${week.length} day${week.length === 1 ? '' : 's'}`} sub={week.map(weekdayOf).join(', ') || undefined} />
      <Stat label="This month" value={`${month.length} day${month.length === 1 ? '' : 's'}`} />
      <Stat label="Weeks in a row" value={String(streakWeeks(rows, today))} />
      <div className="ml-auto flex items-center gap-2">{nav}</div>
    </div>
  )
}
