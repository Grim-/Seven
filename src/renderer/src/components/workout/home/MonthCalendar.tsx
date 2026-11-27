import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { WorkoutHistory } from '@shared/types'
import { showName } from '@shared/ids'
import { Button, Panel } from '../../ui'
import { cn } from '../../../lib/cn'
import { monthDays } from '../progress/stats'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function MonthCalendar({ history, today, month, selected, onMonth, onPick }: { history: WorkoutHistory; today: string; month: string; selected: string | null; onMonth: (month: string) => void; onPick: (date: string) => void }) {
  const [y, m] = month.split('-').map(Number)
  const names = new Map(history.exercises.map((e) => [e.id, showName(e.name)]))
  const done = new Map<string, string[]>()
  for (const r of history.rows) done.set(r.date, [...new Set([...(done.get(r.date) ?? []), names.get(r.exercise) ?? 'removed'])])
  const step = (n: number) => {
    const d = new Date(y, m - 1 + n, 1)
    onMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return (
    <Panel
      title={`${MONTHS[m - 1]} ${y}`}
      meta="filled days are days you trained"
      actions={
        <>
          <Button size="sm" variant="ghost" icon={<ChevronLeft />} title="Previous month" onClick={() => step(-1)} />
          <Button size="sm" variant="ghost" icon={<ChevronRight />} title="Next month" onClick={() => step(1)} />
        </>
      }
      bodyClassName="p-3"
    >
      <div className="grid grid-cols-7 gap-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <span key={d} className="text-center font-label text-[10px] caps-10 text-faint">
            {d}
          </span>
        ))}
        {monthDays(y, m - 1).map((date) => {
          const what = done.get(date)
          const inMonth = date.slice(0, 7) === month
          return (
            <button
              key={date}
              onClick={() => onPick(date)}
              className={cn(
                'flex min-h-16 flex-col gap-0.5 border px-1.5 py-1 text-left',
                what ? 'border-accent/40 bg-accent/10' : 'border-line/25 hover:border-line/60',
                date === today && 'outline outline-1 outline-accent',
                date === selected && 'border-ink/70',
                !inMonth && 'opacity-35'
              )}
            >
              <span className={cn('font-ui text-[11px]', what ? 'text-accent' : date === today ? 'text-accent' : 'text-faint')}>
                {Number(date.slice(8))}
                {date === today ? ' today' : ''}
              </span>
              {what && <span className="line-clamp-3 text-[10.5px] leading-tight text-dim">{what.join(', ')}</span>}
            </button>
          )
        })}
      </div>
    </Panel>
  )
}
