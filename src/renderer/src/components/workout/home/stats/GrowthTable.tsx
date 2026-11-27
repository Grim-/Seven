import type { WorkoutHistory } from '@shared/types'
import { showName } from '@shared/ids'
import { GridRow, GridTable, Panel, type GridColumn } from '../../../ui'
import { growth, type Period } from '@shared/workoutInsights'
import { UnitLabel } from '../UnitLabel'
import { Change } from './Change'
import { Sparkline } from './Sparkline'

const COLUMNS: GridColumn[] = [
  { label: 'Exercise', width: 'minmax(9rem,1.2fr)' },
  { label: 'Works', width: 'minmax(7rem,1fr)' },
  { label: 'Best set then → now', width: 'minmax(7rem,1fr)' },
  { label: 'Day total then → now', width: 'minmax(7rem,1fr)' },
  { label: 'Change', width: '4.5rem', right: true },
  { label: 'Trend', width: '7.5rem' },
  { label: 'Sessions since a best', width: '6rem', right: true }
]

export function GrowthTable({
  history,
  period,
  onOpen
}: {
  history: WorkoutHistory
  period: Period
  onOpen: (id: string) => void
}) {
  const list = growth(history, period)
  const byId = new Map(history.exercises.map((e) => [e.id, e]))
  return (
    <Panel
      title="Growth"
      meta="first sessions this period against the latest ones; worst first"
      bodyClassName="p-0"
    >
      <GridTable
        columns={COLUMNS}
        empty={!list.length && 'Needs at least two sessions of an exercise in this period.'}
      >
        {list.map((g) => {
          const ex = byId.get(g.id)
          return (
            <GridRow key={g.id} onClick={() => onOpen(g.id)}>
              <span className="truncate text-[13px] font-semibold text-ink">
                {showName(ex?.name ?? '')}
              </span>
              <span className="truncate text-[12px] text-dim">{ex?.muscles.join(', ') || '—'}</span>
              <span className="font-ui text-[12.5px] text-ink">
                {g.bestThen} → {g.bestNow}
                <UnitLabel unit={ex?.unit ?? ''} />
              </span>
              <span className="font-ui text-[12.5px] text-ink">
                {g.totalThen} → {g.totalNow}
              </span>
              <span className="text-right text-[12.5px]">
                <Change value={g.change} />
              </span>
              <Sparkline
                points={g.sessions}
                colour={
                  g.change !== null && g.change < 0 ? 'var(--color-alert)' : 'var(--color-ok)'
                }
              />
              <span className="text-right font-ui text-[12.5px] text-ink">{g.sinceBest}</span>
            </GridRow>
          )
        })}
      </GridTable>
    </Panel>
  )
}
