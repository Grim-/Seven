export type ProblemSeverity = 'error' | 'warning'

export interface ProblemReport {
  severity: ProblemSeverity
  area: string
  message: string
  detail?: string
  request?: string
  sessionId?: string | null
  shown?: boolean
}

export interface Problem extends Omit<ProblemReport, 'shown'> {
  id: string
  firstAt: number
  lastAt: number
  count: number
}

export interface ProblemPrefs {
  keep: number
  stderrLines: number
}

export const PROBLEM_LIMITS: Record<keyof ProblemPrefs, { min: number; max: number; fallback: number }> = {
  keep: { min: 20, max: 2000, fallback: 200 },
  stderrLines: { min: 0, max: 400, fallback: 40 }
}

function clampPref(value: unknown, limit: { min: number; max: number; fallback: number }): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.min(limit.max, Math.max(limit.min, value))) : limit.fallback
}

export function cleanProblemPrefs(value: unknown): ProblemPrefs {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<ProblemPrefs>
  return { keep: clampPref(v.keep, PROBLEM_LIMITS.keep), stderrLines: clampPref(v.stderrLines, PROBLEM_LIMITS.stderrLines) }
}

export function errorReport(err: unknown): Pick<ProblemReport, 'message' | 'detail'> {
  if (err instanceof Error) return { message: err.message || err.name, detail: err.stack }
  return { message: String(err) }
}

const SEVERITIES: readonly ProblemSeverity[] = ['error', 'warning']

function text(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && value.trim() ? value.slice(0, max) : undefined
}

export function cleanProblemReport(value: unknown): ProblemReport {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const severity = SEVERITIES.find((s) => s === v.severity)
  const message = text(v.message, 2000)
  if (!severity || !message) throw new Error('A problem needs a severity of error or warning and a message.')
  const detail = text(v.detail, 20000)
  const request = text(v.request, 120)
  const sessionId = text(v.sessionId, 120)
  return { severity, area: text(v.area, 60) ?? 'app', message, ...(detail ? { detail } : {}), ...(request ? { request } : {}), ...(sessionId ? { sessionId } : {}), shown: v.shown === true }
}
