import type { WorkoutHistory } from '@shared/types'
import { showName } from '@shared/ids'
import { Panel } from '../../../ui'
import { agoText } from '../../progress/stats'
import { muscleStats, type Period } from '@shared/workoutInsights'

export function MuscleBalance({
  history,
  period,
  today
}: {
  history: WorkoutHistory
  period: Period
  today: string
}) {
  const { muscles, untagged } = muscleStats(history, period)
  const top = Math.max(1, ...muscles.map((m) => m.sets))
  return (
    <Panel title="Muscles" meta="sets per muscle this period, fewest first" bodyClassName="p-0">
      {muscles.length ? (
        muscles.map((m) => (
          <div
            key={m.muscle}
            className="grid grid-cols-[8rem_minmax(0,1fr)_4.5rem_7rem] items-center gap-3 border-b border-line/20 px-3.5 py-1.5"
          >
            <span className="truncate text-[13px] font-semibold capitalize text-ink">
              {m.muscle}
            </span>
            <div className="h-2.5 bg-ink/5">
              <div className="h-full bg-secondary-ink" style={{ width: `${(m.sets / top) * 100}%` }} />
            </div>
            <span className="text-right font-ui text-[12.5px] text-ink">{m.sets} sets</span>
            <span className="text-right text-[12px] text-dim">
              {m.last ? agoText(m.last, today) : 'never'}
            </span>
          </div>
        ))
      ) : (
        <div className="px-3.5 py-3 text-[12.5px] text-faint">
          No muscles yet. Add them under "Works" on each exercise, in Exercises.
        </div>
      )}
      {untagged.length > 0 && (
        <div className="px-3.5 py-2 text-[11.5px] text-faint">
          Not counted, no muscles set: {untagged.map(showName).join(', ')}
        </div>
      )}
    </Panel>
  )
}
