import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import type { WorkoutHistory, WorkoutOverview } from '@shared/types'
import { showName } from '@shared/ids'
import { valuesText } from '@shared/workout'
import { Button, GridRow, GridTable, Panel, Select, type GridColumn } from '../../ui'
import { engine } from '../../../lib/ipc'
import { toast } from '../../../store/toasts'
import { failed } from '../../../lib/notify'
import { lastValues, trainedDays } from '../progress/stats'
import { shortDate } from '../progress/chartStyle'
import { RecentSessions } from './RecentSessions'
import { SetBoxes, numbersOf } from './SetBoxes'
import { lastDone } from '../Workout'
import { UnitLabel } from './UnitLabel'

const COLUMNS: GridColumn[] = [
  { label: 'Exercise', width: 'minmax(10rem,1fr)' },
  { label: 'Last time', width: 'minmax(8rem,auto)' },
  { label: 'This session, one box per set', width: 'minmax(0,1.6fr)' }
]

const NONE = ''
const LAST = '_last'

interface Row {
  exercise: string
  values: string[]
}

export function LogScreen({
  history,
  overview,
  onOpenDay
}: {
  history: WorkoutHistory
  overview: WorkoutOverview
  onOpenDay: (date: string) => void
}) {
  const [date, setDate] = useState(overview.today)
  const [source, setSource] = useState<string>(lastDone(overview)?.id ?? NONE)
  const [rows, setRows] = useState<Row[]>([])
  const exercises = useMemo(
    () => new Map(history.exercises.map((e) => [e.id, e])),
    [history.exercises]
  )
  const lastDay =
    trainedDays(history.rows)
      .filter((d) => d < date)
      .pop() ?? null

  const fill = (from: string) => {
    if (from === LAST)
      return setRows(
        [...new Set(history.rows.filter((r) => r.date === lastDay).map((r) => r.exercise))].map(
          (exercise) => ({ exercise, values: [] })
        )
      )
    const w = overview.workouts.find((x) => x.id === from)
    setRows(w ? w.exercises.map((e) => ({ exercise: e.id, values: [] })) : [])
  }
  useEffect(() => fill(source), [source])

  const typed = rows.filter((r) => numbersOf(r.values).length)
  const save = async () => {
    try {
      const workout = source && source !== LAST ? source : null
      for (const r of typed)
        await engine('workout.logExercise', {
          date,
          exercise: r.exercise,
          workout,
          values: numbersOf(r.values)
        })
      toast.success(
        'Saved',
        `${typed.length} exercise${typed.length === 1 ? '' : 's'} on ${shortDate(date)}`
      )
      setRows(rows.map((r) => ({ ...r, values: [] })))
    } catch (err) {
      failed('Could not save the session')(err)
    }
  }
  const sources = [
    ...overview.workouts.map((w) => ({
      value: w.id,
      label: showName(w.label)
    })),
    ...(lastDay ? [{ value: LAST, label: `Same exercises as ${shortDate(lastDay)}` }] : []),
    { value: NONE, label: 'Nothing, pick exercises' }
  ]
  const addable = history.exercises.filter((e) => !rows.some((r) => r.exercise === e.id))

  return (
    <div className="grid min-h-0 grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Panel
        title="Log a session"
        meta="numbers are saved exactly as you type them"
        bodyClassName="p-0"
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-line/25 px-3 py-2 text-[12px] text-dim">
          Date
          <input
            type="date"
            value={date}
            max={overview.today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="h-8 border border-line/50 bg-black/60 px-2 font-mono text-[12.5px] text-white outline-none focus:border-accent/70"
          />
          Start from
          <Select
            value={source}
            options={sources}
            onChange={setSource}
            className="h-8 w-64 text-[12.5px]"
          />
        </div>
        <GridTable columns={COLUMNS}>
          {rows.map((r, i) => {
            const ex = exercises.get(r.exercise)
            const last = lastValues(history.rows, r.exercise, date)
            return (
              <GridRow key={r.exercise}>
                <span className="truncate text-[13px] font-semibold text-white">
                  {showName(ex?.name ?? 'removed exercise')}
                  <UnitLabel unit={ex?.unit ?? ''} />
                </span>
                <span className="font-mono text-[12px] text-dim">
                  {last ? `${valuesText(last.values)} · ${shortDate(last.date)}` : 'first time'}
                </span>
                <SetBoxes
                  values={r.values}
                  hints={last?.values}
                  onChange={(values) =>
                    setRows(rows.map((x, j) => (j === i ? { ...x, values } : x)))
                  }
                />
              </GridRow>
            )
          })}
        </GridTable>
        <div className="flex flex-wrap items-center gap-3 px-3 py-2">
          {addable.length > 0 && (
            <Select
              value=""
              options={[
                { value: '', label: '+ add any exercise' },
                ...addable.map((e) => ({ value: e.id, label: showName(e.name) }))
              ]}
              onChange={(id) => id && setRows([...rows, { exercise: id, values: [] }])}
              className="h-8 w-56 text-[12.5px]"
            />
          )}
          <span className="text-[11.5px] text-faint">
            Empty boxes are skipped. The faint number is last time's.
          </span>
          <Button
            variant="primary"
            icon={<Save />}
            disabled={!typed.length}
            onClick={() => void save()}
            className="ml-auto"
          >
            Save session
          </Button>
        </div>
      </Panel>
      <Panel title="Recent sessions" meta="click one to see or change it" bodyClassName="p-0">
        <RecentSessions history={history} today={overview.today} limit={6} onOpen={onOpenDay} />
      </Panel>
    </div>
  )
}
