import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { WorkoutHistory } from '@shared/types'
import { showName } from '@shared/ids'
import {
  Button,
  Eyebrow,
  GridRow,
  GridTable,
  Panel,
  Select,
  confirmDelete,
  type GridColumn
} from '../../ui'
import { engine } from '../../../lib/ipc'
import { failed } from '../../../lib/notify'
import { dayLabel } from '../progress/stats'
import { SetBoxes, numbersOf } from './SetBoxes'
import { UnitLabel } from './UnitLabel'

const COLUMNS: GridColumn[] = [
  { label: 'Exercise', width: 'minmax(10rem,1fr)' },
  { label: 'Sets', width: 'minmax(0,1.8fr)' },
  { label: 'Total', width: '4rem', right: true }
]

function DayRow({
  date,
  exercise,
  workout,
  values,
  name,
  unit,
  workoutName
}: {
  date: string
  exercise: string
  workout: string | null
  values: number[]
  name: string
  unit: string
  workoutName: string | null
}) {
  const [draft, setDraft] = useState(values.map(String))
  const commit = () => {
    const next = numbersOf(draft)
    if (next.join(',') === values.join(',')) return
    void engine('workout.setLog', { date, exercise, workout, values: next }).catch(
      failed('Could not save the change')
    )
  }
  return (
    <GridRow onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && commit()}>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-white">
          {showName(name)}
          <UnitLabel unit={unit} />
        </span>
        {workoutName && <span className="text-[11px] text-faint">{showName(workoutName)}</span>}
      </span>
      <SetBoxes values={draft} onChange={setDraft} />
      <span className="text-right font-mono text-[13px] text-white">
        {numbersOf(draft)
          .reduce((a, b) => a + b, 0)
          .toLocaleString()}
      </span>
    </GridRow>
  )
}

export function DayEditor({ history, date }: { history: WorkoutHistory; date: string }) {
  const [added, setAdded] = useState<string[]>([])
  const exercises = new Map(history.exercises.map((e) => [e.id, e]))
  const workouts = new Map(history.workouts.map((w) => [w.id, w.name]))
  const rows = history.rows.filter((r) => r.date === date)
  const shown = [
    ...rows.map((r) => ({ exercise: r.exercise, workout: r.workout, values: r.values })),
    ...added
      .filter((id) => !rows.some((r) => r.exercise === id))
      .map((exercise) => ({ exercise, workout: null, values: [] as number[] }))
  ]
  const addable = history.exercises.filter((e) => !shown.some((r) => r.exercise === e.id))
  return (
    <Panel
      title={dayLabel(date)}
      meta={
        rows.length
          ? 'changes save when you leave a row; clearing every box removes it'
          : 'nothing logged on this day'
      }
      actions={
        rows.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 />}
            onClick={() =>
              confirmDelete(
                `Delete everything on ${dayLabel(date)}?`,
                'Every exercise logged that day is removed.',
                () => engine('workout.deleteDay', { date })
              )
            }
          >
            Delete day
          </Button>
        )
      }
      bodyClassName="p-0"
    >
      {shown.length > 0 && (
        <GridTable columns={COLUMNS}>
          {shown.map((r) => {
            const ex = exercises.get(r.exercise)
            return (
              <DayRow
                key={`${date}|${r.exercise}|${r.workout ?? ''}|${r.values.join(',')}`}
                date={date}
                exercise={r.exercise}
                workout={r.workout}
                values={r.values}
                name={ex?.name ?? 'removed exercise'}
                unit={ex?.unit ?? ''}
                workoutName={r.workout ? (workouts.get(r.workout) ?? 'removed workout') : null}
              />
            )
          })}
        </GridTable>
      )}
      <div className="flex items-center gap-3 px-3 py-2">
        {addable.length > 0 && (
          <Select
            value=""
            options={[
              { value: '', label: '+ add an exercise to this day' },
              ...addable.map((e) => ({ value: e.id, label: showName(e.name) }))
            ]}
            onChange={(id) => id && setAdded([...added, id])}
            className="h-8 w-64 text-[12.5px]"
          />
        )}
        <Eyebrow className="ml-auto text-[10px] text-faint">
          {rows.reduce((n, r) => n + r.values.length, 0)} sets
        </Eyebrow>
      </div>
    </Panel>
  )
}
