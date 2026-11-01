import type { WorkoutHistory } from '@shared/types'
import { showName } from '@shared/ids'
import { GridRow, GridTable, Panel, type GridColumn } from '../../../ui'
import { cn } from '../../../../lib/cn'
import { targetStats, type Period } from '@shared/workoutInsights'

const COLUMNS: GridColumn[] = [
  { label: 'Exercise', width: 'minmax(8rem,1.4fr)' },
  { label: 'Workout', width: 'minmax(6rem,1.2fr)' },
  { label: 'Target', width: 'minmax(3.5rem,0.6fr)' },
  { label: 'In target', width: 'minmax(4.5rem,0.7fr)', right: true },
  { label: 'Below', width: 'minmax(4rem,0.6fr)', right: true }
]

export function TargetsTable({
  history,
  period,
  onOpen
}: {
  history: WorkoutHistory
  period: Period
  onOpen: (id: string) => void
}) {
  const list = targetStats(history, period)
  const names = new Map(history.exercises.map((e) => [e.id, e.name]))
  const workouts = new Map(history.workouts.map((w) => [w.id, w.name]))
  return (
    <Panel
      title="Targets"
      meta="sets that reached the bottom of the workout's target"
      bodyClassName="p-0"
    >
      <GridTable
        columns={COLUMNS}
        empty={!list.length && 'No sets logged under a workout with a target this period.'}
      >
        {list.map((t) => (
          <GridRow key={`${t.id}|${t.workout}`} onClick={() => onOpen(t.id)}>
            <span className="truncate text-[13px] font-semibold text-white">
              {showName(names.get(t.id) ?? '')}
            </span>
            <span className="truncate text-[12.5px] text-dim">
              {showName(workouts.get(t.workout) ?? '')}
            </span>
            <span className="font-mono text-[12.5px] text-dim">
              {t.min === t.max ? t.max : `${t.min}-${t.max}`}
            </span>
            <span className="text-right font-mono text-[12.5px] text-white">
              {Math.round((t.hit / t.sets) * 100)}%
            </span>
            <span
              className={cn(
                'text-right font-mono text-[12.5px]',
                t.sets - t.hit ? 'text-alert' : 'text-faint'
              )}
            >
              {t.sets - t.hit} {t.sets - t.hit === 1 ? 'set' : 'sets'}
            </span>
          </GridRow>
        ))}
      </GridTable>
    </Panel>
  )
}
