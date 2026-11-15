import { useEffect, useState } from 'react'
import { AlarmClock, Bell, Check, Lock, Pause, Play, Trash2, X } from 'lucide-react'
import type { Reminder, ReminderFired } from '@shared/types'
import { Button, EmptyState, Panel } from '../ui'
import { AgentAvatar } from '../agents/look'
import { engine, on } from '../../lib/ipc'
import { toast } from '../../store/toasts'
import { useAgents } from '../../store/agents'
import { useVault } from '../../store/vault'
import { cn } from '../../lib/cn'
import { entryMenuAt } from '../../views/data/entryMenu'
import { failed } from '../../lib/notify'
import { openChat } from '../../lib/conversation'
import { useReminderList } from '../../lib/reminders'
import { noteFailure } from '../../store/problems'

export const REPEAT_LABEL: Record<Reminder['repeat'], string> = { none: 'once', hourly: 'every hour', daily: 'every day', weekdays: 'weekdays', weekly: 'every week' }

export function reminderWhen(at: number): string {
  return new Date(at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function chime(): void {
  try {
    const ctx = new AudioContext()
    for (const [i, f] of [880, 660, 880].entries()) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.25)
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.25 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.25 + 0.22)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + i * 0.25)
      o.stop(ctx.currentTime + i * 0.25 + 0.25)
    }
    setTimeout(() => void ctx.close().catch(noteFailure('reminders', 'Could not close the chime')), 1500)
  } catch (err) {
    noteFailure('reminders', 'Could not play the chime')(err)
  }
}

export function ReminderAlarms() {
  const agents = useAgents((s) => s.list)
  const askUnlock = useVault((s) => s.ask)
  const [alarms, setAlarms] = useState<ReminderFired[]>([])

  useEffect(
    () =>
      on('reminder.fired', (r) => {
        if (r.kind === 'run' && r.text !== null) {
          toast.info('Scheduled task started', r.text.slice(0, 120))
          return
        }
        chime()
        setAlarms((list) => [...list.filter((a) => a.id !== r.id), r])
      }),
    []
  )

  if (!alarms.length) return null
  const close = (id: string) => setAlarms((list) => list.filter((a) => a.id !== id))
  const snooze = (id: string) =>
    void engine('reminders.snooze', { id, minutes: 10 })
      .then(() => close(id))
      .catch(failed('Could not snooze'))

  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-[9000] flex w-96 flex-col gap-2">
      {alarms.map((a) => {
        const agent = agents.find((x) => x.id === a.agentId)
        return (
          <div key={a.id} className="pointer-events-auto flex flex-col gap-2.5 border border-accent border-l-4 bg-black/95 p-3.5 shadow-[0_0_30px_color-mix(in_srgb,var(--color-accent)_35%,transparent)]" style={{ animation: 'seven-menu-in 150ms ease-out' }}>
            <div className="flex items-center gap-2">
              <AlarmClock className="h-4 w-4 animate-pulse text-accent" />
              <span className="flex-1 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
                {a.kind === 'run' ? 'Scheduled task due' : 'Reminder'}
                {a.late ? ' (late)' : ''}
              </span>
              <button onClick={() => close(a.id)} className="text-dim hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-start gap-2.5">
              <AgentAvatar agent={agent} size={28} />
              {a.text === null ? (
                <span className="text-[13px] text-dim">Something is due, but the vault is locked. Unlock to see it{a.kind === 'run' ? ' and let the task run' : ''}.</span>
              ) : (
                <span className="whitespace-pre-wrap text-[14px] leading-snug text-white">{a.text}</span>
              )}
            </div>
            <div className="flex gap-2">
              {a.text === null ? (
                <Button size="sm" variant="primary" icon={<Lock />} onClick={() => (askUnlock(), close(a.id))}>
                  Unlock
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="primary" icon={<Check />} onClick={() => close(a.id)}>
                    Done
                  </Button>
                  <Button size="sm" variant="secondary" icon={<Bell />} onClick={() => snooze(a.id)}>
                    Snooze 10 min
                  </Button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ReminderList() {
  const agents = useAgents((s) => s.list)
  const { list, error } = useReminderList()

  const act = (p: Promise<Reminder[]>) => void p.catch(failed('Could not change it'))

  return (
    <Panel className="flex-1" title="Reminders and scheduled tasks" meta={list ? `#${list.length}` : undefined} bodyClassName="flex flex-col gap-1 overflow-y-auto p-3">
      {error && <div className="font-mono text-[11px] text-alert">{error}</div>}
      {list && !list.length && <EmptyState title="Nothing scheduled">Ask an agent with the Reminders module to remind you of something, or to do something at a set time.</EmptyState>}
      {list?.map((r) => {
        const agent = agents.find((a) => a.id === r.agentId)
        return (
          <div key={r.id} onContextMenu={(e) => entryMenuAt(e, 'reminder', r.id, r.text.slice(0, 60))} className={cn('flex items-start gap-3 border-b border-line/30 px-1 py-2.5', !r.enabled && 'opacity-50')}>
            <AgentAvatar agent={agent} size={26} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.1em]">
                <span className={r.kind === 'run' ? 'text-purple' : 'text-accent'}>{r.kind === 'run' ? 'Task' : 'Reminder'}</span>
                <span className="text-teal/80">{reminderWhen(r.next)}</span>
                <span className="text-faint">{REPEAT_LABEL[r.repeat]}</span>
                {!r.enabled && <span className="text-faint">paused</span>}
              </div>
              <div className="mt-0.5 whitespace-pre-wrap text-[13px] text-white/90">{r.text}</div>
              {r.sessionId && (
                <button className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-accent hover:text-white" onClick={() => openChat(r.sessionId!)}>
                  Open chat
                </button>
              )}
            </div>
            <Button size="sm" variant="ghost" icon={r.enabled ? <Pause /> : <Play />} onClick={() => act(engine('reminders.enable', { id: r.id, on: !r.enabled }))}>
              {r.enabled ? 'Pause' : 'Resume'}
            </Button>
            <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => act(engine('reminders.cancel', { id: r.id }))}>
              Cancel
            </Button>
          </div>
        )
      })}
    </Panel>
  )
}
