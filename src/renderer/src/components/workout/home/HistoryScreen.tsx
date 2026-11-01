import { useState } from 'react'
import type { WorkoutHistory } from '@shared/types'
import { DayEditor } from './DayEditor'
import { MonthCalendar } from './MonthCalendar'

export function HistoryScreen({ history, today, day, onDay }: { history: WorkoutHistory; today: string; day: string; onDay: (date: string) => void }) {
  const [month, setMonth] = useState(day.slice(0, 7))
  const [shown, setShown] = useState(day)
  if (shown !== day) {
    setShown(day)
    setMonth(day.slice(0, 7))
  }
  return (
    <div className="grid min-h-0 grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <MonthCalendar history={history} today={today} month={month} selected={day} onMonth={setMonth} onPick={onDay} />
      <DayEditor key={day} history={history} date={day} />
    </div>
  )
}
