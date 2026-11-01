import type { WorkoutHistory } from '@shared/types'
import { showName } from '@shared/ids'
import { valuesText } from '@shared/workout'
import { agoText, dayLabel, trainedDays } from '../progress/stats'
import { UnitLabel } from './UnitLabel'

export function RecentSessions({ history, today, limit, onOpen }: { history: WorkoutHistory; today: string; limit: number; onOpen: (date: string) => void }) {
  const names = new Map(history.exercises.map((e) => [e.id, e]))
  const workouts = new Map(history.workouts.map((w) => [w.id, w.name]))
  const days = trainedDays(history.rows).reverse().slice(0, limit)
  if (!days.length) return <div className="px-3 py-4 text-[12.5px] text-faint">Nothing logged yet.</div>
  return (
    <div className="flex flex-col">
      {days.map((date) => {
        const rows = history.rows.filter((r) => r.date === date)
        const used = [...new Set(rows.map((r) => (r.workout ? (workouts.get(r.workout) ?? 'removed workout') : null)).filter(Boolean))]
        return (
          <button key={date} onClick={() => onOpen(date)} className="flex flex-col gap-1 border-b border-line/25 px-3 py-2 text-left hover:bg-white/[0.03]">
            <span className="flex items-baseline gap-2">
              <span className="text-[13px] font-semibold text-white">{dayLabel(date)}</span>
              <span className="text-[11.5px] text-faint">
                {agoText(date, today)} · {used.length ? used.map((u) => showName(u!)).join(', ') : 'no workout'} · {rows.reduce((n, r) => n + r.values.length, 0)} sets
              </span>
            </span>
            {rows.map((r, i) => (
              <span key={i} className="flex gap-3 text-[12.5px]">
                <span className="w-44 shrink-0 truncate text-dim">{showName(names.get(r.exercise)?.name ?? 'removed exercise')}</span>
                <span className="font-mono text-white">
                  {valuesText(r.values)}
                  <UnitLabel unit={names.get(r.exercise)?.unit ?? ''} />
                </span>
              </span>
            ))}
          </button>
        )
      })}
    </div>
  )
}
