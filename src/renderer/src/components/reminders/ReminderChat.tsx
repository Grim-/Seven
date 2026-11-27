import { EmptyState } from '../ui'
import { useReminderList } from '../../lib/reminders'
import { useNow } from '../../lib/useNow'
import { EntryCard, Facts, Loading, BigStat } from '../entries/EntryCard'
import { REPEAT_LABEL, reminderWhen } from './Reminders'
import type { EntrySurfaceProps } from '../../registries/kinds'

function useReminder(id: string) {
  const { list } = useReminderList()
  return { list, reminder: list?.find((r) => r.id === id) }
}

function left(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000))
  if (m >= 1440) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

export function ReminderChat({ id }: EntrySurfaceProps) {
  const { list, reminder } = useReminder(id)
  if (!list) return <Loading />
  if (!reminder) return <EmptyState title="Gone">This reminder has finished or was cancelled.</EmptyState>
  return (
    <EntryCard title={reminder.text.split('\n')[0].slice(0, 60)} tag="reminder" aside={!reminder.enabled ? <span className="font-label text-[11px] caps text-faint">Paused</span> : undefined}>
      <Facts rows={[['When', <span className="text-accent">{reminderWhen(reminder.next)}</span>], ['Repeats', REPEAT_LABEL[reminder.repeat]], ['Note', reminder.text]]} />
    </EntryCard>
  )
}

export function ReminderWidget({ id }: EntrySurfaceProps) {
  const { reminder } = useReminder(id)
  const now = useNow(60_000)
  if (!reminder) return <Loading />
  return (
    <div className="flex flex-col gap-2">
      <BigStat value={left(reminder.next - now)} label={reminderWhen(reminder.next)} />
      <span className="text-[12.5px] text-ink/90">{reminder.text}</span>
    </div>
  )
}

export function ReminderStage({ id }: EntrySurfaceProps) {
  const { reminder } = useReminder(id)
  if (!reminder) return <Loading />
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="font-label text-[12px] caps-20 text-secondary">{reminderWhen(reminder.next)} · reminder</span>
      <span className="max-w-3xl text-[44px] font-semibold leading-tight text-ink">{reminder.text}</span>
      <span className="font-label text-[11px] caps-14 text-faint">{REPEAT_LABEL[reminder.repeat]}</span>
    </div>
  )
}
