import path from 'node:path'
import { EventEmitter } from 'node:events'
import type { Reminder, ReminderFired, ReminderRepeat } from '@shared/types'
import { isVaultLocked } from '@shared/sealed'
import { isChatBusy } from '../chat/busy'
import { newId, readJson, writeJson } from '../util/fs'
import { dataRoot } from '../util/paths'
import { secure, vaultEvents } from '../util/secure'

const FILE = path.join(dataRoot, 'reminders.json')
const TIMES = path.join(dataRoot, 'reminder-times.json')
const MAX = 100
const LATE_MS = 2 * 60_000
const RETRY_MS = 30_000

interface Time {
  id: string
  next: number
  kind: Reminder['kind']
  agentId: string
  enabled: boolean
}

export function nextAfter(from: number, repeat: ReminderRepeat, now = Date.now()): number | null {
  if (repeat === 'none') return null
  const d = new Date(from)
  const step = () => {
    if (repeat === 'hourly') d.setHours(d.getHours() + 1)
    else if (repeat === 'weekly') d.setDate(d.getDate() + 7)
    else d.setDate(d.getDate() + 1)
  }
  for (let i = 0; i < 2000; i++) {
    step()
    if (repeat === 'weekdays' && (d.getDay() === 0 || d.getDay() === 6)) continue
    if (d.getTime() > now) return d.getTime()
  }
  return null
}

export interface RunHook {
  run(reminder: Reminder): Promise<void>
}

export class Reminders extends EventEmitter {
  private timer: NodeJS.Timeout | null = null
  private waiting = new Set<string>()
  private busy = new Set<string>()
  private hook: RunHook | null = null

  constructor() {
    super()
    vaultEvents.on('unlocked', () => {
      this.sync()
      for (const id of [...this.waiting]) void this.fire(id)
    })
  }

  start(hook: RunHook): void {
    this.hook = hook
    this.schedule()
  }

  private times(): Time[] {
    return readJson<Time[]>(TIMES, [])
  }

  private readable(): boolean {
    return !secure.enabled || secure.unlocked
  }

  list(): Reminder[] {
    return readJson<Reminder[]>(FILE, []).sort((a, b) => a.next - b.next)
  }

  private save(list: Reminder[]): Reminder[] {
    writeJson(FILE, list)
    writeJson(
      TIMES,
      list.map((r) => ({ id: r.id, next: r.next, kind: r.kind, agentId: r.agentId, enabled: r.enabled }) satisfies Time)
    )
    this.emit('changed', list)
    this.schedule()
    return list
  }

  private sync(): void {
    try {
      const list = this.list()
      writeJson(
        TIMES,
        list.map((r) => ({ id: r.id, next: r.next, kind: r.kind, agentId: r.agentId, enabled: r.enabled }) satisfies Time)
      )
    } catch (err) {
      if (!isVaultLocked(err)) throw err
    }
  }

  add(input: { agentId: string; sessionId: string | null; kind: Reminder['kind']; text: string; repeat: ReminderRepeat; at: number }): Reminder {
    const list = this.list()
    if (list.length >= MAX) throw new Error(`There are already ${MAX} reminders, the most Seven keeps. Use list_reminders and cancel_reminder to remove ones no longer needed, then call set_reminder again.`)
    const reminder: Reminder = { id: newId('rem'), agentId: input.agentId, sessionId: input.sessionId, kind: input.kind, text: input.text.trim(), repeat: input.repeat, next: input.at, enabled: true, createdAt: Date.now(), lastFiredAt: null }
    this.save([...list, reminder])
    return reminder
  }

  cancel(id: string): Reminder[] {
    const list = this.list()
    if (!list.some((r) => r.id === id)) throw new Error(`There is no reminder "${id}"`)
    this.waiting.delete(id)
    return this.save(list.filter((r) => r.id !== id))
  }

  setEnabled(id: string, enabled: boolean): Reminder[] {
    return this.save(this.list().map((r) => (r.id === id ? { ...r, enabled } : r)))
  }

  snooze(id: string, minutes: number): Reminder[] {
    const list = this.list()
    const r = list.find((x) => x.id === id)
    if (!r) throw new Error(`There is no reminder "${id}"`)
    const snoozed: Reminder = { ...r, id: newId('rem'), repeat: 'none', next: Date.now() + minutes * 60_000, enabled: true, createdAt: Date.now(), lastFiredAt: null }
    return this.save([...list, snoozed])
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const due = this.times()
      .filter((t) => t.enabled && !this.waiting.has(t.id) && !this.busy.has(t.id))
      .map((t) => t.next)
    if (!due.length) return
    const wait = Math.max(0, Math.min(...due) - Date.now())
    this.timer = setTimeout(() => this.tick(), Math.min(wait, 60_000))
  }

  private tick(): void {
    const now = Date.now()
    for (const t of this.times()) if (t.enabled && t.next <= now && !this.waiting.has(t.id) && !this.busy.has(t.id)) void this.fire(t.id)
    this.schedule()
  }

  private advance(id: string, firedAt: number): void {
    const list = this.list()
    const r = list.find((x) => x.id === id)
    if (!r) return
    const next = nextAfter(r.next, r.repeat)
    this.save(next === null ? list.filter((x) => x.id !== id) : list.map((x) => (x.id === id ? { ...x, next, lastFiredAt: firedAt } : x)))
  }

  private async fire(id: string): Promise<void> {
    this.busy.add(id)
    try {
      await this.fireNow(id)
    } finally {
      this.busy.delete(id)
      this.schedule()
    }
  }

  private async fireNow(id: string): Promise<void> {
    const time = this.times().find((t) => t.id === id)
    if (!time) {
      this.waiting.delete(id)
      return
    }
    const late = Date.now() - time.next > LATE_MS
    if (!this.readable()) {
      if (!this.waiting.has(id)) {
        this.waiting.add(id)
        this.emit('fired', { id, agentId: time.agentId, kind: time.kind, text: null, late, sessionId: null } satisfies ReminderFired)
      }
      return
    }
    this.waiting.delete(id)
    const reminder = this.list().find((r) => r.id === id)
    if (!reminder) return
    if (reminder.kind === 'remind') {
      this.emit('fired', { id, agentId: reminder.agentId, kind: 'remind', text: reminder.text, late, sessionId: reminder.sessionId } satisfies ReminderFired)
      this.advance(id, Date.now())
      return
    }
    try {
      await this.hook?.run(reminder)
      this.emit('fired', { id, agentId: reminder.agentId, kind: 'run', text: reminder.text, late, sessionId: reminder.sessionId } satisfies ReminderFired)
      this.advance(id, Date.now())
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (isChatBusy(err)) {
        await new Promise((r) => setTimeout(r, RETRY_MS))
        return this.fireNow(id)
      }
      this.emit('failed', { id, message })
      this.advance(id, Date.now())
    }
  }
}

export const reminders = new Reminders()
