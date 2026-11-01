import type { WorkoutHistory } from '@shared/types'
import { showName } from '@shared/ids'
import { GridRow, GridTable, Panel, type GridColumn } from '../../../ui'
import { cn } from '../../../../lib/cn'
import { overdue } from '@shared/workoutInsights'

const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`

const COLUMNS: GridColumn[] = [
  { label: 'Exercise', width: 'minmax(8rem,1.6fr)' },
  { label: 'Last done', width: 'minmax(5.5rem,1fr)', right: true },
  { label: 'Usually every', width: 'minmax(5.5rem,1fr)', right: true },
  { label: 'Overdue by', width: 'minmax(5.5rem,1fr)', right: true }
]

export function OverdueTable({
  history,
  today,
  onOpen
}: {
  history: WorkoutHistory
  today: string
  onOpen: (id: string) => void
}) {
  const list = overdue(
    history.rows,
    history.exercises.map((e) => e.id),
    today
  )
  const names = new Map(history.exercises.map((e) => [e.id, e.name]))
  return (
    <Panel
      title="Falling behind"
      meta="against how often you usually do each one"
      bodyClassName="p-0"
    >
      <GridTable
        columns={COLUMNS}
        empty={!list.length && 'Needs at least two sessions of an exercise.'}
      >
        {list.map((o) => (
          <GridRow key={o.id} onClick={() => onOpen(o.id)}>
            <span className="truncate text-[13px] font-semibold text-white">
              {showName(names.get(o.id) ?? '')}
            </span>
            <span className="text-right font-mono text-[12.5px] text-white">
              {days(o.sinceLast)} ago
            </span>
            <span className="text-right font-mono text-[12.5px] text-dim">{days(o.usual)}</span>
            <span
              className={cn(
                'text-right font-mono text-[12.5px]',
                o.overdue > 0 ? 'text-alert' : 'text-faint'
              )}
            >
              {o.overdue > 0 ? days(o.overdue) : 'on time'}
            </span>
          </GridRow>
        ))}
      </GridTable>
    </Panel>
  )
}
