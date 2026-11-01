import { X } from 'lucide-react'
import { Button, SegmentBar, ShellFace } from '../ui'
import { registerPresentation, type PresentationProps } from '../../registries/presentations'
import { useReminderList } from '../../lib/reminders'
import { useNow } from '../../lib/useNow'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'

function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const two = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`
}

function TimerCard({ fields, draft }: PresentationProps) {
  const label = typeof fields.label === 'string' && fields.label.trim() ? fields.label.trim() : 'Timer'
  const id = typeof fields.reminder === 'string' ? fields.reminder : null
  const at = typeof fields.at === 'number' ? fields.at : null
  const startedAt = typeof fields.startedAt === 'number' ? fields.startedAt : null
  const { list } = useReminderList()
  const exists = list === null || list.some((r) => r.id === id)
  const live = Boolean(id && at && exists && !draft)
  const now = useNow(250, live)
  const left = at ? at - now : 0
  const state = draft || !id || !at ? 'starting' : left <= 0 ? 'done' : exists ? 'running' : 'cancelled'
  const span = at && startedAt ? Math.max(1, at - startedAt) : 1
  return (
    <div className="my-2 w-64">
      <ShellFace
        label="Timer"
        aside={state === 'running' ? '' : state}
        title={label}
        body={
          <div className="flex flex-col gap-2">
            <div className="font-mono text-[34px] font-bold tabular-nums leading-none text-white">{state === 'done' ? '00:00' : clock(state === 'starting' ? (typeof fields.seconds === 'number' ? fields.seconds * 1000 : 0) : left)}</div>
            <SegmentBar value={state === 'running' ? left / span : state === 'done' ? 0 : 1} tone={state === 'done' ? 'hot' : undefined} />
            {state === 'running' && id && (
              <div>
                <Button size="sm" variant="ghost" icon={<X />} onClick={() => void engine('reminders.cancel', { id }).catch(failed('Could not stop the timer'))}>
                  Stop
                </Button>
              </div>
            )}
          </div>
        }
      />
    </div>
  )
}

registerPresentation('timer', TimerCard)
