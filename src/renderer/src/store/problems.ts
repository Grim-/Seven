import { create } from 'zustand'
import { errorReport, type Problem, type ProblemReport, type ProblemSeverity } from '@shared/problems'
import { isNotFound } from '@shared/errors'
import { isVaultLockedError, main, on, requestOf } from '../lib/ipc'
import { failed } from '../lib/notify'
import { showSheet } from '../lib/sheet'
import { setErrorToastAction, useToasts, watchErrorToasts } from './toasts'
import type { WindowMode } from './bootstrap'

export const NOTIFICATIONS_SHEET = 'notifications'

export const useProblems = create<{ list: Problem[] }>(() => ({ list: [] }))

export function reportProblem(report: ProblemReport): void {
  void main('problems.report', report).catch((err: unknown) =>
    useToasts.getState().push({ kind: 'error', title: 'Could not record a problem', message: `${report.message} (${err instanceof Error ? err.message : String(err)})` })
  )
}

export function reportFailure(area: string, err: unknown, severity: ProblemSeverity = 'error'): void {
  reportProblem({ severity, area, ...errorReport(err), request: requestOf(err) })
}

export function noteFailure(area: string, what: string): (err: unknown) => undefined
export function noteFailure<T>(area: string, what: string, fallback: () => T): (err: unknown) => T
export function noteFailure<T>(area: string, what: string, fallback?: () => T): (err: unknown) => T | undefined {
  return (err) => {
    if (!isVaultLockedError(err) && !isNotFound(err)) {
      const { message, detail } = errorReport(err)
      reportProblem({ severity: 'warning', area, message: `${what}: ${message}`, detail, request: requestOf(err) })
    }
    return fallback?.()
  }
}

export function dismissProblem(id: string): void {
  void main('problems.dismiss', { id }).catch(failed('Could not dismiss the problem'))
}

export function clearProblems(): void {
  void main('problems.clear').catch(failed('Could not clear the problems'))
}

export function startProblems(mode: WindowMode): void {
  const open = mode === 'app' ? { label: 'Open', onSelect: () => showSheet(NOTIFICATIONS_SHEET) } : undefined
  setErrorToastAction(open)
  on('problems.changed', (list) => useProblems.setState({ list }))
  on('problem.new', ({ problem, shown }) => {
    if (shown || problem.severity !== 'error' || problem.count > 1) return
    useToasts.getState().push({ kind: 'error', title: `Problem in ${problem.area}`, message: problem.message, action: open })
  })
  watchErrorToasts((title, message, extra) => reportProblem({ severity: 'error', area: mode, message: message ? `${title}: ${message}` : title, ...extra, shown: true }))
  void main('problems.list').then(
    (list) => useProblems.setState({ list }),
    (err: unknown) => reportFailure(mode, err)
  )
}

export function watchWindowErrors(): void {
  const area = () => document.documentElement.dataset.mode ?? 'app'
  window.addEventListener('error', (e) => {
    // Chromium emits a benign warning ErrorEvent (with null e.error) when third-party ResizeObservers settle across frames.
    if (!e.error && typeof e.message === 'string' && e.message.startsWith('ResizeObserver loop')) return
    reportFailure(area(), e.error ?? e.message)
  })
  window.addEventListener('unhandledrejection', (e) => reportFailure(area(), e.reason))
}
