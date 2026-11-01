import { useState, type ReactNode } from 'react'
import type { LibrarySection } from '@shared/types'
import { Send } from 'lucide-react'
import { Button, Segmented } from '../ui'
import { openExport } from '../export/exportStore'
import { trainedDays } from './progress/stats'
import type { DataSelection } from '../../store/data'
import { KindList } from '../../views/data/KindList'
import { WorkoutState, useWorkout } from './Workout'
import { useWorkoutHistory } from './progress/useWorkoutHistory'
import { ExercisesScreen } from './home/ExercisesScreen'
import { HistoryScreen } from './home/HistoryScreen'
import { LogScreen } from './home/LogScreen'
import { StatsScreen } from './home/StatsScreen'
import { TrainingStrip } from './home/TrainingStrip'

type Tab = 'log' | 'history' | 'exercises' | 'stats' | 'workouts'

const TABS: { value: Tab; label: string }[] = [
  { value: 'log', label: 'Log' },
  { value: 'history', label: 'History' },
  { value: 'exercises', label: 'Exercises' },
  { value: 'stats', label: 'Stats' },
  { value: 'workouts', label: 'Workouts' }
]

function Pane({ on, children }: { on: boolean; children: ReactNode }) {
  return <div className={on ? 'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1' : 'hidden'}>{children}</div>
}

export function WorkoutHome({ section, selected, select }: { section: LibrarySection; selected: DataSelection; select: (s: DataSelection | null) => void }) {
  const [tab, setTab] = useState<Tab>('log')
  const [day, setDay] = useState<string | null>(null)
  const [exercise, setExercise] = useState<string | null>(null)
  const { overview, error } = useWorkout()
  const { history, error: historyError } = useWorkoutHistory()
  if (error || historyError || !overview || !history) return <WorkoutState error={error ?? historyError} />
  const openExercise = (id: string) => {
    setExercise(id)
    setTab('exercises')
  }
  const openDay = (date: string) => {
    setDay(date)
    setTab('history')
  }
  const shownDay = day ?? trainedDays(history.rows).filter((d) => d <= overview.today).pop() ?? overview.today
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <TrainingStrip
        rows={history.rows}
        today={overview.today}
        nav={
          <>
            <Segmented value={tab} onChange={setTab} options={TABS} />
            <Button size="sm" variant="ghost" icon={<Send />} onClick={() => openExport('workout')}>
              Hand to an agent
            </Button>
          </>
        }
      />
      <Pane on={tab === 'log'}>
        <LogScreen history={history} overview={overview} onOpenDay={openDay} />
      </Pane>
      <Pane on={tab === 'history'}>
        <HistoryScreen history={history} today={overview.today} day={shownDay} onDay={setDay} />
      </Pane>
      <Pane on={tab === 'exercises'}>
        <ExercisesScreen history={history} today={overview.today} picked={exercise} onPick={setExercise} />
      </Pane>
      <Pane on={tab === 'stats'}>
        <StatsScreen history={history} today={overview.today} onOpenExercise={openExercise} />
      </Pane>
      <Pane on={tab === 'workouts'}>
        <div className="flex min-h-[24rem] flex-col">
          <KindList section={section} selected={selected} select={select} />
        </div>
      </Pane>
    </div>
  )
}
