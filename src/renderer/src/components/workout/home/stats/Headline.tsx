import type { WorkoutLogRow } from '@shared/types'
import { shortDate } from '../../progress/chartStyle'
import { headline, type Period } from '@shared/workoutInsights'
import { Change } from './Change'
import { StatCard } from './StatCard'

const one = (n: number) => (Math.round(n * 10) / 10).toString()

export function Headline({
  rows,
  period,
  today
}: {
  rows: WorkoutLogRow[]
  period: Period
  today: string
}) {
  const h = headline(rows, period, today)
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-3">
      <StatCard
        label="Days per week"
        value={one(h.perWeek)}
        sub={
          h.perWeekBefore === null ? (
            'average this period'
          ) : (
            <>
              average;{' '}
              <Change
                value={h.perWeek - h.perWeekBefore}
                text={`${h.perWeek >= h.perWeekBefore ? '▲' : '▼'} from ${one(h.perWeekBefore)}`}
              />{' '}
              the period before
            </>
          )
        }
      />
      <StatCard
        label="Longest break"
        value={
          h.longestBreak
            ? `${h.longestBreak.days} day${h.longestBreak.days === 1 ? '' : 's'}`
            : 'none'
        }
        sub={
          h.longestBreak
            ? `between ${shortDate(h.longestBreak.from)} and ${shortDate(h.longestBreak.to)}`
            : 'no days off between sessions'
        }
      />
      <StatCard
        label="Since last workout"
        value={h.sinceLast === null ? '—' : `${h.sinceLast} day${h.sinceLast === 1 ? '' : 's'}`}
        sub={
          h.usualGap === null
            ? undefined
            : `your usual gap is ${Math.round(h.usualGap)} day${Math.round(h.usualGap) === 1 ? '' : 's'}`
        }
      />
      <StatCard
        label="Personal bests"
        value={String(h.bests)}
        sub={
          h.bests
            ? `new best sets this period, on ${h.bestExercises} exercise${h.bestExercises === 1 ? '' : 's'}`
            : 'no new best sets this period'
        }
      />
    </div>
  )
}
