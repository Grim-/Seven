import type { WorkoutHistory, WorkoutLogRow, WorkoutTarget } from './types'

export type Metric = 'best' | 'total'

export const METRICS: { value: Metric; label: string; hint: string }[] = [
  { value: 'best', label: 'Best set', hint: 'The highest number in one set' },
  { value: 'total', label: 'Session total', hint: 'Every set of the exercise added up' }
]

export interface SessionPoint {
  date: string
  best: number
  total: number
  sets: number
  values: number[]
}

export function parseDay(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function format(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDays(date: string, n: number): string {
  const d = parseDay(date)
  d.setDate(d.getDate() + n)
  return format(d)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000)
}

export function weekStart(date: string): string {
  const d = parseDay(date)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return format(d)
}

const sum = (v: number[]) => v.reduce((a, b) => a + b, 0)

export function seriesFor(rows: WorkoutLogRow[], exercise: string): SessionPoint[] {
  const byDate = new Map<string, number[]>()
  for (const r of rows)
    if (r.exercise === exercise) byDate.set(r.date, [...(byDate.get(r.date) ?? []), ...r.values])
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, values]) => ({
      date,
      best: Math.max(...values),
      total: sum(values),
      sets: values.length,
      values
    }))
}

export function streakWeeks(rows: WorkoutLogRow[], today: string): number {
  const weeks = new Set(rows.map((r) => weekStart(r.date)))
  let w = weekStart(today)
  if (!weeks.has(w)) w = addDays(w, -7)
  let n = 0
  while (weeks.has(w)) {
    n += 1
    w = addDays(w, -7)
  }
  return n
}

export type Targets = Record<string, Record<string, WorkoutTarget>>

export function targetFor(
  rows: WorkoutLogRow[],
  targets: Targets,
  exercise: string
): { target: WorkoutTarget; workout: string } | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i]
    if (r.exercise === exercise && r.workout && targets[r.workout]?.[exercise])
      return { target: targets[r.workout][exercise], workout: r.workout }
  }
  const workout = Object.keys(targets).find((w) => targets[w][exercise])
  return workout ? { target: targets[workout][exercise], workout } : null
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function weekdayOf(date: string): string {
  return DAYS[parseDay(date).getDay()]
}

export function agoText(date: string, today: string): string {
  const n = daysBetween(date, today)
  if (n <= 0) return 'today'
  if (n === 1) return 'yesterday'
  if (n < 14) return `${n} days ago`
  if (n < 60) return `${Math.round(n / 7)} weeks ago`
  return `${Math.round(n / 30)} months ago`
}

export function monthDays(year: number, month: number): string[] {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7))
  const out: string[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    out.push(format(d))
    if (i >= 34 && d.getMonth() !== month && i % 7 === 6) break
  }
  return out
}

export interface ExerciseTotals {
  last: string | null
  first: string | null
  total: number
  inPeriod: number
  bestSet: number
  bestSetDate: string | null
  bestDay: number
  bestDayDate: string | null
  days: number
}

export function exerciseTotals(
  rows: WorkoutLogRow[],
  exercise: string,
  from: string | null
): ExerciseTotals {
  const series = seriesFor(rows, exercise)
  const out: ExerciseTotals = {
    last: null,
    first: null,
    total: 0,
    inPeriod: 0,
    bestSet: 0,
    bestSetDate: null,
    bestDay: 0,
    bestDayDate: null,
    days: series.length
  }
  for (const p of series) {
    out.first ??= p.date
    out.last = p.date
    out.total += p.total
    if (!from || p.date >= from) out.inPeriod += p.total
    if (p.best > out.bestSet) [out.bestSet, out.bestSetDate] = [p.best, p.date]
    if (p.total > out.bestDay) [out.bestDay, out.bestDayDate] = [p.total, p.date]
  }
  return out
}

export function lastValues(
  rows: WorkoutLogRow[],
  exercise: string,
  before: string
): { date: string; values: number[] } | null {
  let date: string | null = null
  for (const r of rows)
    if (r.exercise === exercise && r.date < before && (!date || r.date > date)) date = r.date
  if (!date) return null
  return {
    date,
    values: rows.filter((r) => r.exercise === exercise && r.date === date).flatMap((r) => r.values)
  }
}

export function trainedDays(rows: WorkoutLogRow[]): string[] {
  return [...new Set(rows.map((r) => r.date))].sort()
}

export function allMuscles(history: Pick<WorkoutHistory, 'exercises'>): string[] {
  const seen = new Map<string, string>()
  for (const e of history.exercises)
    for (const m of e.muscles) if (!seen.has(m.toLowerCase())) seen.set(m.toLowerCase(), m)
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}
