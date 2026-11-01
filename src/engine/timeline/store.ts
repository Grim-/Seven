import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { VaultLocked, isVaultLocked } from '@shared/sealed'
import { dayKey, monthOfDay, type TimelineAction, type TimelineEvent } from '@shared/timeline'
import { dataRoot } from '../util/paths'
import { appendLine, newId, readLines, writeLines } from '../util/fs'
import { vaultEvents } from '../util/secure'
import { currentActor } from './actor'
import { sessionAccess } from '../sessions/access'

const DIR = path.join(dataRoot, 'timeline')
const FOLD_MS = 20 * 60_000
const FLUSH_MS = 1500
const MONTH_FILE = /^\d{4}-\d{2}\.jsonl$/

export interface RecordInput {
  kind: string
  entry: string
  action: TimelineAction
  by?: string | null
  chat?: string | null
}

class Timeline extends EventEmitter {
  private months = new Map<string, TimelineEvent[]>()
  private dirty = new Set<string>()
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    super()
    vaultEvents.on('locked', () => {
      this.flush()
      this.months.clear()
    })
    vaultEvents.on('unlocked', () => this.months.clear())
  }

  private file(month: string): string {
    return path.join(DIR, `${month}.jsonl`)
  }

  private load(month: string): TimelineEvent[] | null {
    const cached = this.months.get(month)
    if (cached) return cached
    try {
      const list = readLines<TimelineEvent>(this.file(month)).filter((e) => e && typeof e.at === 'number' && e.kind && e.entry)
      this.months.set(month, list)
      return list
    } catch (err) {
      if (isVaultLocked(err)) return null
      throw err
    }
  }

  private monthNames(): string[] {
    const disk = fs.existsSync(DIR)
      ? fs
          .readdirSync(DIR)
          .filter((n) => MONTH_FILE.test(n))
          .map((n) => n.slice(0, 7))
      : []
    return [...new Set([...disk, ...this.months.keys()])].sort().reverse()
  }

  private touch(month: string): void {
    this.dirty.add(month)
    if (!this.timer) this.timer = setTimeout(() => this.flush(), FLUSH_MS)
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    for (const month of this.dirty) {
      const list = this.months.get(month)
      if (!list) continue
      fs.mkdirSync(DIR, { recursive: true })
      writeLines(this.file(month), list)
    }
    this.dirty.clear()
  }

  private changed(): void {
    this.emit('changed')
  }

  record(input: RecordInput): void {
    try {
      const actor = currentActor()
      const by = input.by !== undefined ? input.by : actor.agentId
      const asked = input.chat !== undefined ? input.chat : actor.sessionId
      const hidden = sessionAccess.isIncognito(asked)
      if (hidden && input.entry === asked) return
      const chat = hidden ? null : asked
      const now = Date.now()
      const month = monthOfDay(dayKey(now))
      const list = this.load(month)
      const event: TimelineEvent = { id: newId('e'), at: now, last: now, kind: input.kind, entry: input.entry, action: input.action, by, chat }
      if (!list) {
        fs.mkdirSync(DIR, { recursive: true })
        appendLine(this.file(month), event)
        this.changed()
        this.emit('recorded', event)
        return
      }
      for (let i = list.length - 1; i >= 0 && i >= list.length - 200; i--) {
        const e = list[i]
        if (now - e.last >= FOLD_MS) continue
        if (e.kind !== input.kind || e.entry !== input.entry || e.by !== by || dayKey(e.at) !== dayKey(now)) continue
        if (e.action === input.action || (input.action === 'changed' && e.action === 'made')) {
          e.last = now
          if (chat && !e.chat) e.chat = chat
          this.touch(month)
          this.changed()
          this.emit('recorded', { ...e, action: input.action })
          return
        }
      }
      list.push(event)
      fs.mkdirSync(DIR, { recursive: true })
      if (this.dirty.has(month)) this.touch(month)
      else appendLine(this.file(month), event)
      this.changed()
      this.emit('recorded', event)
    } catch (err) {
      console.warn('[timeline] could not record', err)
    }
  }

  private dropWhere(test: (e: TimelineEvent) => boolean, months = this.monthNames()): number {
    let removed = 0
    for (const month of months) {
      const list = this.load(month)
      if (!list) continue
      const kept = list.filter((e) => !test(e))
      if (kept.length === list.length) continue
      removed += list.length - kept.length
      this.months.set(month, kept)
      this.touch(month)
    }
    if (removed) {
      this.flush()
      this.changed()
    }
    return removed
  }

  forget(kind: string, entry: string): void {
    this.forgetMatching(entry, (k) => k === kind)
  }

  forgetMatching(entry: string, kind: (kind: string) => boolean): void {
    try {
      this.dropWhere((e) => e.entry === entry && kind(e.kind))
    } catch (err) {
      console.warn('[timeline] could not forget', err)
    }
  }

  clearChatContext(id: string): void {
    try {
      for (const month of this.monthNames()) {
        const list = this.load(month)
        if (!list) continue
        let hit = false
        for (const e of list)
          if (e.chat === id) {
            e.chat = null
            hit = true
          }
        if (hit) this.touch(month)
      }
      this.flush()
    } catch (err) {
      console.warn('[timeline] could not clear the chat from its events', err)
    }
  }

  forgetDay(day: string): number {
    return this.dropWhere((e) => dayKey(e.at) === day, [monthOfDay(day)])
  }

  day(day: string): TimelineEvent[] {
    const list = this.load(monthOfDay(day))
    if (!list) throw new VaultLocked()
    return list.filter((e) => dayKey(e.at) === day).sort((a, b) => a.at - b.at)
  }

  days(limit: number): { day: string; count: number; last: number }[] {
    const out: { day: string; count: number; last: number }[] = []
    for (const month of this.monthNames()) {
      const list = this.load(month)
      if (!list) continue
      const byDay = new Map<string, { count: number; last: number }>()
      for (const e of list) {
        const key = dayKey(e.at)
        const d = byDay.get(key) ?? { count: 0, last: 0 }
        d.count += 1
        d.last = Math.max(d.last, e.last)
        byDay.set(key, d)
      }
      for (const [day, d] of [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
        out.push({ day, ...d })
        if (out.length >= limit) return out
      }
    }
    return out
  }

  recent(limit: number): TimelineEvent[] {
    const out: TimelineEvent[] = []
    for (const month of this.monthNames()) {
      const list = this.load(month)
      if (!list) continue
      out.push(...list)
      if (out.length >= limit * 3) break
    }
    return out.sort((a, b) => b.last - a.last).slice(0, limit * 3)
  }
}

export const timeline = new Timeline()
