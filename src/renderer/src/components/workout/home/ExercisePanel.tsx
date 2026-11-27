import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import type { WorkoutHistory } from '@shared/types'
import { showName } from '@shared/ids'
import { doseText } from '@shared/workout'
import { Button, ChipInput, Eyebrow, InlineEdit, Panel, Segmented } from '../../ui'
import { engine } from '../../../lib/ipc'
import { failed } from '../../../lib/notify'
import { openEntry } from '../Workout'
import { ExerciseProgress } from '../progress/ExerciseDetail'
import { shortDate } from '../progress/chartStyle'
import { METRICS, allMuscles, exerciseTotals, seriesFor, targetFor, type Metric } from '../progress/stats'

function Record({ label, value, sub, gold = false }: { label: string; value: string; sub?: string | null; gold?: boolean }) {
  return (
    <div className="flex flex-col border border-line/30 px-3 py-1.5">
      <Eyebrow className="text-[10px]">{label}</Eyebrow>
      <span className={gold ? 'font-ui text-[18px] font-semibold text-accent' : 'font-ui text-[18px] font-semibold text-ink'}>{value}</span>
      {sub && <span className="text-[11px] text-faint">{sub}</span>}
    </div>
  )
}

export function ExercisePanel({ history, id }: { history: WorkoutHistory; id: string }) {
  const [metric, setMetric] = useState<Metric>('total')
  const ex = history.exercises.find((e) => e.id === id)
  if (!ex) return null
  const t = exerciseTotals(history.rows, id, null)
  const series = seriesFor(history.rows, id)
  const workouts = new Map(history.workouts.map((w) => [w.id, w.name]))
  const targets = Object.entries(history.targets).filter(([, items]) => items[id]).map(([w, items]) => `${doseText(items[id])} in ${showName(workouts.get(w) ?? 'a workout')}`)
  return (
    <Panel
      title={showName(ex.name)}
      meta={
        <span className="flex items-baseline gap-1.5">
          counted in
          <InlineEdit value={ex.unit} placeholder="reps" title="What one number means" onSave={(unit) => void engine('workout.patchExercise', { id, unit }).catch(failed('Could not change it'))} className="text-ink" />
        </span>
      }
      actions={
        <Button size="sm" variant="ghost" icon={<BookOpen />} onClick={() => openEntry('exercise', id)}>
          How to do it
        </Button>
      }
      bodyClassName="p-0"
    >
      <div className="flex items-center gap-3 border-b border-line/25 px-3 py-1.5 text-[12px] text-dim">
        Works
        <div className="min-w-0 flex-1">
          <ChipInput value={ex.muscles} suggestions={allMuscles(history)} placeholder="Add a muscle, e.g. chest" onChange={(muscles) => void engine('workout.patchExercise', { id, muscles }).catch(failed('Could not change it'))} />
        </div>
      </div>
      {targets.length > 0 && <div className="border-b border-line/25 px-3 py-1.5 text-[12px] text-dim">Target: {targets.join(' · ')}</div>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2 p-3">
        <Record label="All time" value={t.total.toLocaleString()} sub={ex.unit} gold />
        <Record label="Best set" value={t.bestSet.toLocaleString()} sub={t.bestSetDate && shortDate(t.bestSetDate)} />
        <Record label="Best day" value={t.bestDay.toLocaleString()} sub={t.bestDayDate && shortDate(t.bestDayDate)} />
        <Record label="Days done" value={String(t.days)} />
        <Record label="First" value={t.first ? shortDate(t.first) : '—'} />
      </div>
      <div className="flex flex-col gap-2 px-3 pb-3">
        <Segmented value={metric} onChange={setMetric} options={METRICS.map((m) => ({ value: m.value, label: m.value === 'total' ? 'Total per day' : 'Best set', hint: m.hint }))} />
        <ExerciseProgress unit={ex.unit} series={series} metric={metric} target={targetFor(history.rows, history.targets, id)} />
      </div>
    </Panel>
  )
}
