import { useState } from 'react'
import type { WorkoutHistory } from '@shared/types'
import { Segmented } from '../../ui'
import { STATS_RANGES, periodFor, type StatsRange } from '@shared/workoutInsights'
import { ConsistencyChart } from './stats/ConsistencyChart'
import { GrowthTable } from './stats/GrowthTable'
import { Headline } from './stats/Headline'
import { MuscleBalance } from './stats/MuscleBalance'
import { OverdueTable } from './stats/OverdueTable'
import { TargetsTable } from './stats/TargetsTable'

export function StatsScreen({ history, today, onOpenExercise }: { history: WorkoutHistory; today: string; onOpenExercise: (id: string) => void }) {
  const [range, setRange] = useState<StatsRange>('3m')
  const period = periodFor(range, today, history.rows)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Segmented value={range} onChange={setRange} options={STATS_RANGES.map((r) => ({ value: r.value, label: r.label }))} />
      </div>
      <Headline rows={history.rows} period={period} today={today} />
      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
        <ConsistencyChart rows={history.rows} period={period} />
        <MuscleBalance history={history} period={period} today={today} />
      </div>
      <GrowthTable history={history} period={period} onOpen={onOpenExercise} />
      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
        <OverdueTable history={history} today={today} onOpen={onOpenExercise} />
        <TargetsTable history={history} period={period} onOpen={onOpenExercise} />
      </div>
    </div>
  )
}
