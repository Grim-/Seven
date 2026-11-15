import { noteFailure } from '../util/report'
import { notFound } from '@shared/errors'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { isVaultLocked } from '@shared/sealed'
import { isChatBusy } from '../chat/busy'
import type { ChatMessage, PermissionMode } from '@shared/types'
import { PERMISSION_MODES } from '@shared/types'
import type { TimelineEvent } from '@shared/timeline'
import { ROUTINE_REPEATS, type Routine, type RoutineDraft, type RoutineOutput, type RoutineWhen } from '@shared/routines'
import { newId, readJson, writeJson } from '../util/fs'
import { dataRoot } from '../util/paths'
import { vaultEvents } from '../util/secure'
import { nextAfter } from '../reminders/store'
import { timeline } from '../timeline/store'
import { asActor } from '../timeline/actor'

const FILE = path.join(dataRoot, 'routines.json')
const MAX = 100
const SETTLE_MS = 2 * 60_000
const COOLDOWN_MS = 5 * 60_000
const RETRY_MS = 30_000
const MAX_RETRIES = 40

export interface RoutineDeps {
  agentExists(id: string): boolean
  createChat(agentId: string): string
  chatExists(id: string): boolean
  setupChat(id: string, title: string, mode: PermissionMode | null): void
  send(sessionId: string, text: string): Promise<unknown>
  finished(sessionId: string): Promise<ChatMessage>
  describe(event: TimelineEvent): string
  resolveEntry(kind: string, link: string): string
  writePage(page: string, heading: string, text: string): void
  notify(sessionId: string, title: string, message: string): void
}

type Stored = Omit<Routine, 'running'>

function clean(input: RoutineDraft): Omit<Stored, 'id' | 'next' | 'lastRun' | 'lastChat' | 'lastError' | 'createdAt' | 'updatedAt'> {
  const name = input.name.trim().replace(/\s+/g, ' ').slice(0, 80)
  if (!name) throw new Error('A routine needs a name')
  const instruction = input.instruction.trim()
  if (!instruction) throw new Error('Say what the routine should do')
  if (instruction.length > 4000) throw new Error('Keep the instruction under 4000 characters')
  const w = input.when
  let when: RoutineWhen
  if (w.type === 'schedule') {
    if (!Number.isFinite(w.at)) throw new Error('Pick when it first runs')
    if (!ROUTINE_REPEATS.some((r) => r.id === w.repeat)) throw new Error(`Pick how often it repeats: ${ROUTINE_REPEATS.map((r) => r.label.toLowerCase()).join(', ')}.`)
    when = { type: 'schedule', at: w.at, repeat: w.repeat }
  } else {
    if (!w.kind?.trim()) throw new Error('Pick the kind it watches')
    when = { type: 'event', kind: w.kind.trim(), entry: w.entry?.trim() || null, action: w.action === 'made' || w.action === 'changed' ? w.action : 'any', byUser: w.byUser !== false }
  }
  const o = input.output
  const output: RoutineOutput = { chat: o.chat === 'same' ? 'same' : 'new', page: o.page?.trim() || null, notify: o.notify === true }
  const permissionMode = PERMISSION_MODES.some((m) => m.id === input.permissionMode) ? input.permissionMode : null
  return { name, agentId: input.agentId, instruction, when, output, permissionMode, enabled: input.enabled === true }
}

function firstRun(when: RoutineWhen, now = Date.now()): number | null {
  if (when.type !== 'schedule') return null
  if (when.at > now) return when.at
  return when.repeat === 'none' ? null : nextAfter(when.at, when.repeat, now)
}

function replyText(message: ChatMessage): string {
  return message.parts
    .map((p) => (p.type === 'text' ? p.text : ''))
    .join('')
    .trim()
}

class Routines extends EventEmitter {
  private deps: RoutineDeps | null = null
  private timer: NodeJS.Timeout | null = null
  private settle = new Map<string, { timer: NodeJS.Timeout; reason: string }>()
  private queue: { id: string; reason: string | null; manual: boolean }[] = []
  private working = false
  private runningId: string | null = null
  private runningChat: string | null = null

  start(deps: RoutineDeps): void {
    this.deps = deps
    timeline.on('recorded', (e: TimelineEvent) => this.onEvent(e))
    vaultEvents.on('unlocked', () => this.schedule())
    this.schedule()
  }

  private read(): Stored[] {
    return readJson<Stored[]>(FILE, [])
  }

  list(): Routine[] {
    try {
      return this.read()
        .map((r) => ({ ...r, running: r.id === this.runningId }))
        .sort((a, b) => a.name.localeCompare(b.name))
    } catch (err) {
      if (isVaultLocked(err)) return []
      throw err
    }
  }

  get(ref: string): Routine | null {
    const r = ref.trim().toLowerCase()
    return this.list().find((x) => x.id === ref || x.name.toLowerCase() === r) ?? null
  }

  private write(list: Stored[]): void {
    writeJson(FILE, list)
    this.emit('changed', this.list())
    this.schedule()
  }

  private patch(id: string, change: Partial<Stored>): void {
    const list = this.read()
    if (!list.some((r) => r.id === id)) return
    this.write(list.map((r) => (r.id === id ? { ...r, ...change } : r)))
  }

  save(draft: RoutineDraft): Routine {
    if (!this.deps) throw new Error('Routines are not ready yet')
    const value = clean(draft)
    if (!this.deps.agentExists(value.agentId)) throw new Error('Pick an agent to run it')
    if (value.when.type === 'event' && draft.entryLink?.trim()) value.when.entry = this.deps.resolveEntry(value.when.kind, draft.entryLink.trim())
    if (value.output.page && /[\n#]/.test(value.output.page)) throw new Error('Give the page by its name alone, without # or line breaks.')
    const list = this.read()
    const existing = draft.id ? list.find((r) => r.id === draft.id) : undefined
    if (draft.id && !existing) throw notFound(new Error('That routine no longer exists'))
    const clash = list.find((r) => r.id !== existing?.id && r.name.toLowerCase() === value.name.toLowerCase())
    if (clash) throw new Error(`There is already a routine called ${clash.name}. Give this one a different name.`)
    if (!existing && list.length >= MAX) throw new Error(`There are already ${MAX} routines. Delete one before adding another.`)
    const now = Date.now()
    const whenChanged = !existing || JSON.stringify(existing.when) !== JSON.stringify(value.when)
    const routine: Stored = {
      ...value,
      id: existing?.id ?? newId('routine'),
      next: whenChanged ? firstRun(value.when, now) : (existing?.next ?? firstRun(value.when, now)),
      lastRun: existing?.lastRun ?? null,
      lastChat: existing?.lastChat ?? null,
      lastError: existing?.lastError ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }
    if (routine.when.type === 'schedule' && routine.next === null && routine.enabled) throw new Error('That time has passed. Pick a time in the future or make it repeat')
    this.write(existing ? list.map((r) => (r.id === routine.id ? routine : r)) : [...list, routine])
    timeline.record({ kind: 'routine', entry: routine.id, action: existing ? 'changed' : 'made', by: null, chat: null })
    return { ...routine, running: false }
  }

  rename(id: string, name: string): void {
    const r = this.read().find((x) => x.id === id)
    if (!r) throw notFound(new Error('That routine no longer exists'))
    this.save({ ...r, name, id })
  }

  delete(id: string): void {
    const list = this.read()
    if (!list.some((r) => r.id === id)) throw notFound(new Error('That routine no longer exists'))
    const pending = this.settle.get(id)
    if (pending) clearTimeout(pending.timer)
    this.settle.delete(id)
    this.queue = this.queue.filter((q) => q.id !== id)
    this.write(list.filter((r) => r.id !== id))
    timeline.forget('routine', id)
  }

  setEnabled(id: string, enabled: boolean): Routine[] {
    const r = this.read().find((x) => x.id === id)
    if (!r) throw notFound(new Error('That routine no longer exists'))
    const next = r.when.type === 'schedule' ? (r.next && r.next > Date.now() ? r.next : firstRun(r.when)) : null
    if (enabled && r.when.type === 'schedule' && next === null) throw new Error('Its time has passed. Pick a new time first')
    this.patch(id, { enabled, next })
    return this.list()
  }

  runNow(id: string): void {
    if (!this.read().some((r) => r.id === id)) throw notFound(new Error('That routine no longer exists'))
    if (this.runningId === id || this.queue.some((q) => q.id === id)) throw new Error('It is already running or waiting to run. Wait for that run to finish first.')
    this.enqueue(id, null, true)
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    let due: number[]
    try {
      due = this.read()
        .filter((r) => r.enabled && r.when.type === 'schedule' && r.next !== null && r.id !== this.runningId && !this.queue.some((q) => q.id === r.id))
        .map((r) => r.next as number)
    } catch (err) {
      noteFailure(err, 'routines', 'Could not read the routines to schedule them')
      return
    }
    if (!due.length) return
    const wait = Math.max(0, Math.min(...due) - Date.now())
    this.timer = setTimeout(() => this.tick(), Math.min(wait, 60_000))
  }

  private tick(): void {
    const now = Date.now()
    try {
      for (const r of this.read()) if (r.enabled && r.when.type === 'schedule' && r.next !== null && r.next <= now && r.id !== this.runningId && !this.queue.some((q) => q.id === r.id)) this.enqueue(r.id, null, false)
    } catch (err) {
      noteFailure(err, 'routines', 'Could not read the routines to run due ones')
      return
    }
    this.schedule()
  }

  private onEvent(e: TimelineEvent): void {
    if (e.kind === 'routine') return
    let list: Stored[]
    try {
      list = this.read()
    } catch (err) {
      noteFailure(err, 'routines', 'Could not read the routines')
      return
    }
    for (const r of list) {
      if (!r.enabled || r.when.type !== 'event') continue
      const w = r.when
      if (w.kind !== e.kind || (w.entry && w.entry !== e.entry)) continue
      if (w.action !== 'any' && w.action !== e.action) continue
      if (e.action !== 'made' && e.action !== 'changed') continue
      if (w.byUser && e.by !== null) continue
      if (e.chat && (e.chat === this.runningChat || e.chat === r.lastChat)) continue
      const reason = this.deps?.describe(e) ?? `${e.kind} ${e.action}`
      const old = this.settle.get(r.id)
      if (old) clearTimeout(old.timer)
      this.settle.set(r.id, { reason, timer: setTimeout(() => this.settled(r.id), SETTLE_MS) })
    }
  }

  private settled(id: string): void {
    const pending = this.settle.get(id)
    this.settle.delete(id)
    if (!pending) return
    const r = this.read().find((x) => x.id === id)
    if (!r || !r.enabled) return
    const wait = (r.lastRun ?? 0) + COOLDOWN_MS - Date.now()
    if (wait > 0) {
      this.settle.set(id, { reason: pending.reason, timer: setTimeout(() => this.settled(id), wait) })
      return
    }
    if (this.runningId === id || this.queue.some((q) => q.id === id)) return
    this.enqueue(id, pending.reason, false)
  }

  private enqueue(id: string, reason: string | null, manual: boolean): void {
    this.queue.push({ id, reason, manual })
    void this.work()
  }

  private async work(): Promise<void> {
    if (this.working) return
    this.working = true
    try {
      while (this.queue.length) {
        const job = this.queue.shift()!
        await this.run(job.id, job.reason, job.manual)
      }
    } finally {
      this.working = false
      this.schedule()
    }
  }

  private async sendWhenFree(sessionId: string, text: string): Promise<void> {
    for (let i = 0; ; i++) {
      try {
        await this.deps!.send(sessionId, text)
        return
      } catch (err) {
        if (i >= MAX_RETRIES || !isChatBusy(err)) throw err
        await new Promise((r) => setTimeout(r, RETRY_MS))
      }
    }
  }

  private async run(id: string, reason: string | null, manual: boolean): Promise<void> {
    const deps = this.deps
    if (!deps) return
    let r: Stored | undefined
    try {
      r = this.read().find((x) => x.id === id)
    } catch (err) {
      noteFailure(err, 'routines', 'Could not read the routine to run')
      return
    }
    if (!r || (!r.enabled && !manual)) return
    const routine = r
    const startedAt = Date.now()
    const next = routine.when.type === 'schedule' && !manual ? (routine.when.repeat === 'none' ? null : nextAfter(routine.next ?? startedAt, routine.when.repeat, startedAt)) : routine.next
    const done: Partial<Stored> = { lastRun: startedAt, next, ...(routine.when.type === 'schedule' && !manual && next === null ? { enabled: false } : {}) }
    this.runningId = id
    this.emit('changed', this.list())
    try {
      if (!deps.agentExists(routine.agentId)) throw new Error('Its agent no longer exists. Pick another agent to run this routine.')
      const reuse = routine.output.chat === 'same' && routine.lastChat && deps.chatExists(routine.lastChat)
      const sessionId = reuse ? routine.lastChat! : deps.createChat(routine.agentId)
      this.runningChat = sessionId
      const date = new Date(startedAt)
      deps.setupChat(sessionId, routine.output.chat === 'same' ? routine.name : `${routine.name} · ${date.toLocaleDateString()}`, routine.permissionMode)
      await this.sendWhenFree(sessionId, `[Routine: ${routine.name}${reason ? `; because ${reason}` : ''}]\n${routine.instruction}`)
      const message = await deps.finished(sessionId)
      const reply = replyText(message)
      if (routine.output.page && reply) {
        const heading = `${date.toLocaleDateString()} ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
        asActor({ agentId: routine.agentId, sessionId }, () => deps.writePage(routine.output.page!, heading, reply))
      }
      if (routine.output.notify) deps.notify(sessionId, `Routine: ${routine.name}`, reply ? (reply.length > 200 ? `${reply.slice(0, 197)}...` : reply) : 'Finished.')
      timeline.record({ kind: 'routine', entry: id, action: 'ran', by: routine.agentId, chat: sessionId })
      done.lastChat = sessionId
      done.lastError = message.status === 'error' ? (message.error ?? 'The reply failed') : null
    } catch (err) {
      done.lastError = err instanceof Error ? err.message : String(err)
    } finally {
      this.runningId = null
      this.runningChat = null
      this.patch(id, done)
    }
  }
}

export const routines = new Routines()
