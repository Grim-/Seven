import { useState } from 'react'
import { Segmented } from '../../ui'
import { ExerciseProgress, progressSummary } from './ExerciseDetail'
import { METRICS, seriesFor, targetFor, type Metric } from './stats'
import { useWorkoutHistory } from './useWorkoutHistory'
import { WorkoutState } from '../Workout'

export function ExerciseProgressSection({ id, unit }: { id: string; unit: string }) {
  const { history, error } = useWorkoutHistory()
  const [metric, setMetric] = useState<Metric>('best')
  if (error) return <WorkoutState error={error} />
  if (!history) return null
  const series = seriesFor(history.rows, id)
  if (!series.length) return null
  const target = targetFor(history.rows, history.targets, id)
  const names = new Map(history.workouts.map((w) => [w.id, w.name]))
  return (
    <section className="flex flex-col gap-3 border-t border-line/40 pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-soft">Progress</span>
        <Segmented value={metric} onChange={setMetric} options={METRICS} />
        <span className="text-[12px] text-dim">{progressSummary(series, metric, unit, target, (w) => names.get(w) ?? '(removed)')}</span>
      </div>
      <ExerciseProgress unit={unit} series={series} metric={metric} target={target} />
    </section>
  )
}
