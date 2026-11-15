import { EventEmitter } from 'node:events'
import { isVaultLocked } from '@shared/sealed'
import { errorReport, type Problem, type ProblemReport, type ProblemSeverity } from '@shared/problems'
import { settings } from './settings'

export class Problems extends EventEmitter {
  private items: Problem[] = []
  private next = 1

  constructor(private keep: () => number) {
    super()
  }

  list(): Problem[] {
    return this.items
  }

  add(report: ProblemReport): Problem {
    const { shown = false, ...fields } = report
    const now = Date.now()
    const same = this.items.find((p) => p.severity === fields.severity && p.area === fields.area && p.message === fields.message)
    const problem: Problem = same
      ? { ...same, ...fields, lastAt: now, count: same.count + 1 }
      : { ...fields, id: `p${this.next++}`, firstAt: now, lastAt: now, count: 1 }
    this.set([problem, ...this.items.filter((p) => p !== same)])
    this.emit('added', problem, shown)
    return problem
  }

  dismiss(id: string): void {
    this.set(this.items.filter((p) => p.id !== id))
  }

  clear(): void {
    this.set([])
  }

  trim(): void {
    if (this.items.length > this.keep()) this.set(this.items)
  }

  private set(items: Problem[]): void {
    this.items = items.slice(0, this.keep())
    this.emit('changed', this.items)
  }
}

export const problems = new Problems(() => settings.get().problems.keep)

export function noteMainFailure(err: unknown, area: string, what: string, severity: ProblemSeverity = 'warning'): void {
  if (isVaultLocked(err)) return
  const { message, detail } = errorReport(err)
  problems.add({ severity, area, message: `${what}: ${message}`, ...(detail ? { detail } : {}) })
}
