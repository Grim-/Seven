import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { WorkoutHistory } from '@shared/types'
import { showName } from '@shared/ids'
import { Button, GridRow, GridTable, Panel, Segmented } from '../../ui'
import { newWorkoutEntry } from '../Workout'
import { shortDate } from '../progress/chartStyle'
import { agoText, exerciseTotals, weekStart } from '../progress/stats'
import { ExercisePanel } from './ExercisePanel'
import { UnitLabel } from './UnitLabel'

type Period = 'week' | 'month' | 'year' | 'all'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' }
]

function fromOf(period: Period, today: string): string | null {
  if (period === 'week') return weekStart(today)
  if (period === 'month') return `${today.slice(0, 7)}-01`
  if (period === 'year') return `${today.slice(0, 4)}-01-01`
  return null
}

export function ExercisesScreen({
  history,
  today,
  picked,
  onPick
}: {
  history: WorkoutHistory
  today: string
  picked: string | null
  onPick: (id: string) => void
}) {
  const [period, setPeriod] = useState<Period>('month')
  const from = fromOf(period, today)
  const list = useMemo(
    () =>
      history.exercises
        .map((e) => ({ ...e, t: exerciseTotals(history.rows, e.id, from) }))
        .sort(
          (a, b) => (b.t.last ?? '').localeCompare(a.t.last ?? '') || a.name.localeCompare(b.name)
        ),
    [history, from]
  )
  const current = picked && list.some((e) => e.id === picked) ? picked : (list[0]?.id ?? null)
  const label = PERIODS.find((p) => p.value === period)!.label
  return (
    <div className="grid min-h-0 grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <Panel
        title="Exercises"
        actions={
          <>
            <Segmented value={period} onChange={setPeriod} options={PERIODS} />
            <Button
              size="sm"
              variant="ghost"
              icon={<Plus />}
              onClick={() => newWorkoutEntry('exercise', 'exercise', { unit: 'reps' }, onPick)}
            >
              New
            </Button>
          </>
        }
        bodyClassName="p-0"
      >
        <GridTable
          columns={[
            { label: 'Exercise', width: 'minmax(8rem,1.4fr)' },
            { label: 'Last done', width: 'minmax(8rem,1.1fr)' },
            {
              label: period === 'all' ? 'Done' : `Done ${label.toLowerCase()}`,
              width: 'minmax(6rem,1fr)',
              right: true
            },
            { label: 'All time', width: 'minmax(4rem,0.7fr)', right: true }
          ]}
          empty={!list.length && 'No exercises yet.'}
        >
          {list.map((e) => {
            return (
              <GridRow key={e.id} onClick={() => onPick(e.id)} selected={current === e.id}>
                <span className="truncate text-[13px] font-semibold text-ink">
                  {showName(e.name)}
                </span>
                <span className="truncate font-ui text-[12px] text-dim">
                  {e.t.last ? `${shortDate(e.t.last)} · ${agoText(e.t.last, today)}` : 'never'}
                </span>
                <span className="truncate text-right font-ui text-[13px] font-semibold text-accent">
                  {e.t.inPeriod.toLocaleString()}
                  <UnitLabel unit={e.unit} />
                </span>
                <span className="text-right font-ui text-[13px] text-ink">
                  {e.t.total.toLocaleString()}
                </span>
              </GridRow>
            )
          })}
        </GridTable>
      </Panel>
      {current && <ExercisePanel key={current} history={history} id={current} />}
    </div>
  )
}
