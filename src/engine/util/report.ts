import { isNotFound } from '@shared/errors'
import { isVaultLocked } from '@shared/sealed'
import { errorReport, type ProblemReport, type ProblemSeverity } from '@shared/problems'

let sink: ((report: ProblemReport) => void) | null = null
const early: ProblemReport[] = []

export function setProblemSink(fn: (report: ProblemReport) => void): void {
  sink = fn
  for (const report of early.splice(0)) fn(report)
}

export function report(severity: ProblemSeverity, area: string, message: string, extra: Pick<ProblemReport, 'detail' | 'sessionId'> = {}): void {
  const problem: ProblemReport = { severity, area, message, ...extra }
  if (sink) sink(problem)
  else early.push(problem)
}

export function reportError(severity: ProblemSeverity, area: string, err: unknown, what?: string, sessionId?: string | null): void {
  const { message, detail } = errorReport(err)
  report(severity, area, what ? `${what}: ${message}` : message, { detail, ...(sessionId !== undefined ? { sessionId } : {}) })
}

export function logText(parts: unknown[]): string {
  return parts.map((p) => (p instanceof Error ? p.message : typeof p === 'string' ? p : JSON.stringify(p))).join(' ')
}

export function ifMissing<T>(work: () => T, fallback: T): T {
  try {
    return work()
  } catch (err) {
    if (isNotFound(err)) return fallback
    throw err
  }
}

export function noteFailure(err: unknown, area: string, what: string, severity: ProblemSeverity = 'warning'): void {
  if (isNotFound(err) || isVaultLocked(err) || (err as NodeJS.ErrnoException)?.code === 'ENOENT') return
  reportError(severity, area, err, what)
}
