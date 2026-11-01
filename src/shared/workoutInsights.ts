import type { WorkoutHistory, WorkoutLogRow } from './types'
import {
  addDays,
  daysBetween,
  seriesFor,
  trainedDays,
  weekStart,
  type SessionPoint
} from './workoutStats'

export type StatsRange = '4w' | '3m' | '1y' | 'all'

export const STATS_RANGES: { value: StatsRange; label: string; days: number | null }[] = [
  { value: '4w', label: '4 weeks', days: 28 },
  { value: '3m', label: '3 months', days: 91 },
  { value: '1y', label: 'Year', days: 364 },
  { value: 'all', label: 'All time', days: null }
]

export interface Period {
  from: string
  to: string
  previousFrom: string | null
  previousTo: string | null
}

export function periodFor(range: StatsRange, today: string, rows: WorkoutLogRow[]): Period {
  const days = STATS_RANGES.find((r) => r.value === range)?.days ?? null
  if (!days)
    return { from: trainedDays(rows)[0] ?? today, to: today, previousFrom: null, previousTo: null }
  const from = addDays(today, -(days - 1))
  return { from, to: today, previousFrom: addDays(from, -days), previousTo: addDays(from, -1) }
}

const inRange = (date: string, from: string, to: string) => date >= from && date <= to

function median(list: number[]): number | null {
  if (!list.length) return null
  const s = [...list].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function gaps(dates: string[]): { days: number; from: string; to: string }[] {
  return dates.slice(1).map((d, i) => ({ days: daysBetween(dates[i], d), from: dates[i], to: d }))
}

export interface Headline {
  perWeek: number
  perWeekBefore: number | null
  longestBreak: { days: number; from: string; to: string } | null
  sinceLast: number | null
  usualGap: number | null
  bests: number
  bestExercises: number
}

export function headline(rows: WorkoutLogRow[], p: Period, today: string): Headline {
  const days = trainedDays(rows)
  const inP = days.filter((d) => inRange(d, p.from, p.to))
  const weeks = Math.max(1, (daysBetween(p.from, p.to) + 1) / 7)
  const before =
    p.previousFrom && p.previousTo
      ? days.filter((d) => inRange(d, p.previousFrom!, p.previousTo!)).length / weeks
      : null
  const breakList = gaps(days.filter((d) => d <= p.to)).filter((g) => g.to >= p.from)
  const longest = breakList.reduce<{ days: number; from: string; to: string } | null>(
    (m, g) => (!m || g.days > m.days ? g : m),
    null
  )
  const last = days.filter((d) => d <= today).pop() ?? null
  let bests = 0
  const bestExercises = new Set<string>()
  for (const id of new Set(rows.map((r) => r.exercise))) {
    let top = 0
    for (const s of seriesFor(rows, id)) {
      if (s.best > top && top > 0 && inRange(s.date, p.from, p.to)) {
        bests++
        bestExercises.add(id)
      }
      top = Math.max(top, s.best)
    }
  }
  return {
    perWeek: inP.length / weeks,
    perWeekBefore: before,
    longestBreak:
      longest && longest.days > 1
        ? { days: longest.days - 1, from: longest.from, to: longest.to }
        : null,
    sinceLast: last ? daysBetween(last, today) : null,
    usualGap: median(gaps(days).map((g) => g.days)),
    bests,
    bestExercises: bestExercises.size
  }
}

export function weeklyDays(rows: WorkoutLogRow[], p: Period): { week: string; days: number }[] {
  const byWeek = new Map<string, Set<string>>()
  for (const d of trainedDays(rows))
    if (inRange(d, p.from, p.to))
      byWeek.set(weekStart(d), (byWeek.get(weekStart(d)) ?? new Set()).add(d))
  const out: { week: string; days: number }[] = []
  for (let w = weekStart(p.from); w <= p.to; w = addDays(w, 7))
    out.push({ week: w, days: byWeek.get(w)?.size ?? 0 })
  return out
}

export interface MuscleStat {
  muscle: string
  sets: number
  last: string | null
}

export function muscleStats(
  history: WorkoutHistory,
  p: Period
): { muscles: MuscleStat[]; untagged: string[] } {
  const stats = new Map<string, MuscleStat>()
  const musclesOf = new Map(history.exercises.map((e) => [e.id, e.muscles]))
  for (const e of history.exercises)
    for (const m of e.muscles)
      if (!stats.has(m.toLowerCase()))
        stats.set(m.toLowerCase(), { muscle: m, sets: 0, last: null })
  for (const r of history.rows) {
    for (const m of musclesOf.get(r.exercise) ?? []) {
      const s = stats.get(m.toLowerCase())!
      if (inRange(r.date, p.from, p.to)) s.sets += r.values.length
      if (!s.last || r.date > s.last) s.last = r.date
    }
  }
  const logged = new Set(
    history.rows.filter((r) => inRange(r.date, p.from, p.to)).map((r) => r.exercise)
  )
  return {
    muscles: [...stats.values()].sort(
      (a, b) => a.sets - b.sets || a.muscle.localeCompare(b.muscle)
    ),
    untagged: history.exercises
      .filter((e) => !e.muscles.length && logged.has(e.id))
      .map((e) => e.name)
  }
}

export interface Growth {
  id: string
  sessions: SessionPoint[]
  bestThen: number
  bestNow: number
  totalThen: number
  totalNow: number
  change: number | null
  sinceBest: number
}

export function growth(history: WorkoutHistory, p: Period): Growth[] {
  const out: Growth[] = []
  for (const e of history.exercises) {
    const all = seriesFor(history.rows, e.id)
    const sessions = all.filter((s) => inRange(s.date, p.from, p.to))
    if (sessions.length < 2) continue
    const part = Math.max(1, Math.floor(sessions.length / 3))
    const first = sessions.slice(0, part)
    const latest = sessions.slice(-part)
    const avg = (list: SessionPoint[]) => list.reduce((n, s) => n + s.total, 0) / list.length
    const totalThen = avg(first)
    const totalNow = avg(latest)
    let top = 0
    let lastBest = 0
    all.forEach((s, i) => {
      if (s.best > top) {
        top = s.best
        lastBest = i
      }
    })
    out.push({
      id: e.id,
      sessions,
      bestThen: Math.max(...first.map((s) => s.best)),
      bestNow: Math.max(...latest.map((s) => s.best)),
      totalThen: Math.round(totalThen),
      totalNow: Math.round(totalNow),
      change: totalThen ? (totalNow - totalThen) / totalThen : null,
      sinceBest: all.length - 1 - lastBest
    })
  }
  return out.sort((a, b) => (a.change ?? 0) - (b.change ?? 0))
}

export interface Overdue {
  id: string
  sinceLast: number
  usual: number
  overdue: number
}

export function overdue(rows: WorkoutLogRow[], ids: string[], today: string): Overdue[] {
  const out: Overdue[] = []
  for (const id of ids) {
    const dates = seriesFor(rows, id).map((s) => s.date)
    const usual = median(gaps(dates).map((g) => g.days))
    if (usual === null) continue
    const sinceLast = daysBetween(dates[dates.length - 1], today)
    out.push({ id, sinceLast, usual: Math.round(usual), overdue: Math.round(sinceLast - usual) })
  }
  return out.sort((a, b) => b.overdue - a.overdue)
}

export interface TargetStat {
  id: string
  workout: string
  min: number
  max: number
  sets: number
  hit: number
}

export function targetStats(history: WorkoutHistory, p: Period): TargetStat[] {
  const stats = new Map<string, TargetStat>()
  for (const r of history.rows) {
    if (!r.workout || !inRange(r.date, p.from, p.to)) continue
    const t = history.targets[r.workout]?.[r.exercise]
    if (!t) continue
    const key = `${r.exercise}|${r.workout}`
    const s = stats.get(key) ?? {
      id: r.exercise,
      workout: r.workout,
      min: t.min,
      max: t.max,
      sets: 0,
      hit: 0
    }
    s.sets += r.values.length
    s.hit += r.values.filter((v) => v >= t.min).length
    stats.set(key, s)
  }
  return [...stats.values()].sort((a, b) => a.hit / a.sets - b.hit / b.sets)
}
