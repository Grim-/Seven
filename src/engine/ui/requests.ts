import { EventEmitter } from 'node:events'
import type { PendingRequest, UiRequestKind } from '@shared/types'
import { newId } from '../util/fs'

interface Pending {
  sessionId: string
  kind: UiRequestKind
  label: string
  tool: string
  at: number
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  cleanup: () => void
}

export class UiCancelled extends Error {
  constructor() {
    super('Cancelled')
  }
}

export class UiRequests extends EventEmitter {
  private pending = new Map<string, Pending>()

  open(sessionId: string, kind: UiRequestKind, signal: AbortSignal, label = '', tool = ''): { id: string; answer: Promise<unknown> } {
    const id = newId('ui')
    const answer = new Promise<unknown>((resolve, reject) => {
      if (signal.aborted) {
        reject(new UiCancelled())
        return
      }
      const onAbort = () => {
        this.pending.delete(id)
        this.emit('changed')
        reject(new UiCancelled())
      }
      signal.addEventListener('abort', onAbort, { once: true })
      this.pending.set(id, {
        sessionId,
        kind,
        label,
        tool,
        at: Date.now(),
        resolve,
        reject,
        cleanup: () => signal.removeEventListener('abort', onAbort)
      })
      this.emit('changed')
    })
    return { id, answer }
  }

  respond(id: string, value: unknown): boolean {
    const entry = this.pending.get(id)
    if (!entry) return false
    this.pending.delete(id)
    entry.cleanup()
    entry.resolve(value)
    this.emit('changed')
    return true
  }

  resolveKind(kind: UiRequestKind, value: unknown): string[] {
    const ids: string[] = []
    for (const [id, entry] of this.pending) if (entry.kind === kind) ids.push(id)
    for (const id of ids) this.respond(id, value)
    return ids
  }

  list(): PendingRequest[] {
    return [...this.pending.entries()].map(([id, p]) => ({ id, sessionId: p.sessionId, kind: p.kind, label: p.label, tool: p.tool, at: p.at }))
  }

  hasPending(sessionId: string): boolean {
    for (const p of this.pending.values()) if (p.sessionId === sessionId) return true
    return false
  }
}
