import { noteFailure } from '../util/report'
import fs from 'node:fs'
import path from 'node:path'
import type { ExerciseData, PageMeta, WorkoutData, WorkoutDay, WorkoutExercise, WorkoutItem, WorkoutLogRow, WorkoutNote, WorkoutOverview, WorkoutPageType, WorkoutHistory, WorkoutSession } from '@shared/types'
import { cleanSvg } from '@shared/svg'
import { toId } from '@shared/ids'
import { doseText, unitText, valuesText } from '@shared/workout'
import { copyPath, readJson, readText, removePath, writeJson, writeText } from '../util/fs'
import { dataRoot } from '../util/paths'
import { ToolError } from '../tools/types'
import { data } from '../data/hub'
import builtinPlan from '../../modules/workout/default-plan.json'

export const EXERCISE: WorkoutPageType = 'exercise'
export const WORKOUT: WorkoutPageType = 'workout'

const DIR = path.join(dataRoot, 'moduledata', 'workout')
const OLD_PLANS = path.join(DIR, 'plans.json')
const OLD_LOG = path.join(DIR, 'log.json')
const STATE = path.join(DIR, 'state.json')
const HISTORY = path.join(DIR, 'history.json')
const OLD_ROTATIONS = path.join(DIR, 'rotations.json')
const OLD_SET = 'workout-set'
const OLD_PLAN = 'workout-plan'
const VERSION = 4

interface OldTip {
  kind: string
  label: string
  text: string
}

interface OldExercise {
  name: string
  dose: string
  steps: string[]
  tips?: OldTip[]
  figures?: string[]
}

interface OldDay {
  id: string
  label: string
  exercises: OldExercise[]
}

interface OldPlan {
  id: string
  title: string
  subtitle?: string
  before?: WorkoutNote[]
  workouts: OldDay[]
  after?: WorkoutNote[]
}

interface ImportExercise {
  name: string
  dose?: string
  steps?: string[]
  tips?: OldTip[]
  figures?: string[]
  how?: unknown
  dos?: unknown
  donts?: unknown
  easier?: string
  video?: string
  measure?: string
  unit?: string
  muscles?: string[]
}

interface ImportDay {
  id?: string
  label: string
  before?: WorkoutNote[]
  exercises: ImportExercise[]
  after?: WorkoutNote[]
}

interface Notes {
  before: WorkoutNote[]
  after: WorkoutNote[]
}

interface OldSession {
  date: string
  plan: string
  planName?: string
  workout: string
  label?: string
  data: Record<string, number[]>
}

interface State {
  converted: boolean
  version: number
}

const DOSE_RULE = '- dose starts with the number of sets ("3 x ..."); the rep range (or seconds for holds) after it is the target.'
const TIPS_RULE = '- tips kind is "easy" (an easier version) or "avoid" (a common mistake).'
const FIGURES_RULE =
  '- figures are optional small stick-figure SVG drawings, viewBox 0 0 200 110, using only line, circle, path, polyline and text, with class="l" for limbs, "h" for the head, "g" for the ground and "ar" for movement arrows. No styles or scripts.'
const JSON_ONLY = '- Reply with the JSON only.'
const EXERCISE_SHAPE = `{"name": "Push-up", "dose": "3 x 8-15",
    "steps": ["Hands under shoulders.", "Body in one straight line.", "..."],
    "tips": [{"kind": "easy", "label": "Too hard?", "text": "Knees on the floor."}, {"kind": "avoid", "label": "Avoid:", "text": "Sagging hips."}],
    "figures": ["<svg viewBox=\\"0 0 200 110\\">...</svg>"]}`

const WORKOUTS_SHAPE = `{"workouts": [{"label": "Workout A",
   "before": [{"title": "Warm-up", "text": "..."}],
   "exercises": [
   ${EXERCISE_SHAPE}],
   "after": [{"title": "Cool-down", "text": "..."}]}]}`

const EXERCISES_SHAPE = `{"exercises": [
  {"name": "Push-up", "unit": "reps",
   "how": ["Hands under shoulders.", "Body in one straight line.", "..."],
   "dos": ["Squeeze your glutes."], "donts": ["Sagging hips."], "easier": "Knees on the floor.",
   "video": "https://example.com/push-up",
   "figures": ["<svg viewBox=\\"0 0 200 110\\">...</svg>"]}]}`

export interface ImportFormat {
  what: string
  shape: string
  rules: string[]
}

export const IMPORT_FORMATS: ImportFormat[] = [
  {
    what: 'workouts',
    shape: WORKOUTS_SHAPE,
    rules: [DOSE_RULE, TIPS_RULE, FIGURES_RULE, '- before and after are optional notes shown above and below the workout, e.g. a warm-up and a cool-down.', '- Keep exercise names the same as the exercises I already have where it is the same exercise; those are reused and only new ones are made from your steps, tips and figures.']
  },
  {
    what: 'exercises',
    shape: EXERCISES_SHAPE,
    rules: [
      '- unit is what one number means, e.g. "reps", "seconds" for holds, "reps per arm".',
      '- muscles is an optional list of the muscles it works, e.g. ["chest", "triceps"].',
      '- how, dos and donts are lists of short lines; easier is one sentence; video is optional and an https link.',
      FIGURES_RULE,
      '- An exercise I already have (same name) is left as it is.'
    ]
  }
]

function formatPrompt(f: ImportFormat): string {
  return `Write me ${f.what} for Seven, my workout tracker, as JSON in exactly this shape:\n\n${f.shape}\n\nRules:\n${[...f.rules, JSON_ONLY].join('\n')}`
}

export const WORKOUTS_FORMAT = formatPrompt(IMPORT_FORMATS[0])
export const EXERCISES_FORMAT = formatPrompt(IMPORT_FORMATS[1])

export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseDose(dose: string): { sets: number; min: number; max: number; seconds: boolean } {
  const sets = /^\s*(\d+)\s*[x×]/i.exec(dose || '')
  const m = /[x×]\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*(s|secs?|seconds?|mins?|minutes?)?\b/i.exec(dose || '')
  const minutes = Boolean(m?.[3] && /^m/i.test(m[3]))
  const scale = minutes ? 60 : 1
  const low = m ? parseInt(m[1], 10) * scale : 8
  const high = m ? parseInt(m[2] || m[1], 10) * scale : 12
  return { sets: sets ? parseInt(sets[1], 10) : 3, min: Math.min(low, high), max: Math.max(low, high), seconds: Boolean(m?.[3]) }
}

function lines(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean)
  if (typeof value === 'string') return value.split('\n').map((v) => v.replace(/^\s*(?:[-*]|\d+[.)])\s+/, '').trim()).filter(Boolean)
  return []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function ids(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean) : []
}

function count(value: unknown, fallback: number): number {
  const n = Math.round(Number(value))
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

function notes(value: unknown): WorkoutNote[] {
  return Array.isArray(value) ? value.filter((n): n is WorkoutNote => Boolean(n) && typeof n === 'object').map((n) => ({ title: text(n.title), text: text(n.text) })).filter((n) => n.title || n.text) : []
}

export function cleanExercise(raw: unknown): ExerciseData {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const video = text(d.video)
  return {
    how: lines(d.how),
    dos: lines(d.dos),
    donts: lines(d.donts),
    easier: text(d.easier),
    figures: (Array.isArray(d.figures) ? d.figures : [])
      .map((f) => {
        try {
          return cleanSvg(String(f))
        } catch {
          return null
        }
      })
      .filter((f): f is string => Boolean(f)),
    video: /^https?:\/\//i.test(video) ? video : null,
    unit: text(d.unit) || (d.measure === 'seconds' ? 'seconds' : 'reps'),
    muscles: muscleList(d.muscles)
  }
}

export function muscleList(value: unknown): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of Array.isArray(value) ? value : []) {
    const name = String(m).trim()
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase())
      out.push(name)
    }
  }
  return out
}

function exerciseFrom(ex: ImportExercise): Record<string, unknown> {
  const tips = ex.tips ?? []
  return {
    how: ex.how ?? ex.steps,
    dos: ex.dos,
    donts: [...lines(ex.donts), ...tips.filter((t) => t.kind !== 'easy').map((t) => t.text)],
    easier: text(ex.easier) || tips.filter((t) => t.kind === 'easy').map((t) => t.text).join(' '),
    figures: ex.figures,
    video: ex.video,
    unit: ex.unit || (ex.measure === 'seconds' || parseDose(ex.dose ?? '').seconds ? 'seconds' : 'reps'),
    muscles: ex.muscles
  }
}

export function cleanItem(raw: unknown): WorkoutItem | null {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const exercise = text(d.exercise)
  if (!exercise) return null
  const min = count(d.min, 8)
  const max = count(d.max, min)
  return { exercise, sets: Math.max(1, count(d.sets, 3)), min: Math.min(min, max), max: Math.max(min, max) }
}

export function cleanWorkout(raw: unknown): WorkoutData {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return { items: (Array.isArray(d.items) ? d.items : []).map(cleanItem).filter((i): i is WorkoutItem => Boolean(i)), before: notes(d.before), after: notes(d.after) }
}

function withNotes(current: Notes, extra: Notes): Notes {
  const has = (list: WorkoutNote[], n: WorkoutNote) => list.some((x) => x.title === n.title && x.text === n.text)
  return { before: [...current.before, ...extra.before.filter((n) => !has(current.before, n))], after: [...current.after, ...extra.after.filter((n) => !has(current.after, n))] }
}

function planNotes(raw: unknown): Notes {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const about = text(d.subtitle)
  return { before: [...(about ? [{ title: text(d.title), text: about }] : []), ...notes(d.before)], after: notes(d.after) }
}

function checkRow(raw: unknown): WorkoutLogRow | string {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'it is not a row'
  const d = raw as Record<string, unknown>
  const date = typeof d.date === 'string' ? d.date : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return `date ${JSON.stringify(d.date ?? null)} is not YYYY-MM-DD`
  const exercise = text(d.exercise)
  if (!exercise) return 'it has no exercise'
  if (!Array.isArray(d.values) || !d.values.length) return 'it has no numbers'
  const bad = d.values.find((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0)
  if (bad !== undefined) return `${JSON.stringify(bad)} is not a number of 0 or more`
  return { date, exercise, workout: text(d.workout) || null, values: d.values as number[] }
}

function importRow(raw: { date: unknown; exercise: string; workout: string | null; values: unknown }, skipped: unknown[]): WorkoutLogRow | null {
  const values = Array.isArray(raw.values) ? raw.values.map((v) => (typeof v === 'string' && v.trim() ? Number(v) : v)) : raw.values
  const row = checkRow({ ...raw, values })
  if (typeof row !== 'string') return row
  skipped.push({ problem: row, row: raw })
  return null
}

function keepSkipped(skipped: unknown[], label: string): void {
  if (skipped.length) writeJson(path.join(dataRoot, '_backup', `workout-${label}-skipped-${Date.now()}.json`), skipped)
}

function byDate(a: WorkoutLogRow, b: WorkoutLogRow): number {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0
}

const CLEAN: Record<WorkoutPageType, (raw: unknown) => unknown> = { exercise: cleanExercise, workout: cleanWorkout }
const LABEL: Record<WorkoutPageType, string> = { exercise: 'exercise', workout: 'workout' }

function readOld<T>(file: string, fallback: T): T {
  try {
    return fs.existsSync(file) ? (JSON.parse(readText(file)) as T) : fallback
  } catch (err) {
    noteFailure(err, 'workout', 'Could not read a workout file')
    return fallback
  }
}

class WorkoutStore {
  private notify: () => void = () => undefined
  private converting = false

  onChange(fn: () => void): void {
    this.notify = fn
  }

  private changed(): void {
    this.notify()
  }

  private state(): State {
    const s = readOld<Partial<State>>(STATE, {})
    return { converted: s.converted === true, version: typeof s.version === 'number' ? s.version : 1 }
  }

  private saveState(s: State): void {
    fs.mkdirSync(DIR, { recursive: true })
    writeText(STATE, JSON.stringify(s, null, 1))
  }

  rows(): WorkoutLogRow[] {
    this.ensure()
    return this.readRows()
  }

  private readRows(): WorkoutLogRow[] {
    const raw = readJson<unknown>(HISTORY, [])
    const where = path.relative(dataRoot, HISTORY)
    if (!Array.isArray(raw)) throw new Error(`Could not read ${where}: it should be a list of rows. Nothing was saved over it.`)
    return raw
      .map((r, i) => {
        const row = checkRow(r)
        if (typeof row === 'string') throw new Error(`Could not read ${where}: row ${i + 1}: ${row}. Fix that row by hand, or restore the file from a backup. Nothing was saved over it.`)
        return row
      })
      .sort(byDate)
  }

  private writeRows(rows: WorkoutLogRow[]): void {
    fs.mkdirSync(DIR, { recursive: true })
    writeJson(HISTORY, [...rows].sort(byDate))
  }

  pagesOf(type: WorkoutPageType): PageMeta[] {
    return data.pages.ofType(type)
  }

  private findOf(type: WorkoutPageType, ref: string): PageMeta | null {
    return data.pages.find(ref, (p) => p.type === type)
  }

  find(type: WorkoutPageType, ref: string): PageMeta {
    const hit = this.findOf(type, ref)
    if (hit) return hit
    const names = this.pagesOf(type).map((p) => `${type} ${data.pages.pathOf(p.id)}`)
    throw new ToolError(`No ${type} ${toId(ref)}.${names.length ? ` There are: ${names.slice(0, 30).join(', ')}${names.length > 30 ? ', …' : ''}.` : ` There are no ${LABEL[type]}s yet.`}`)
  }

  private dataOf<T>(type: WorkoutPageType, id: string): T {
    return CLEAN[type](data.pages.get(id).data) as T
  }

  private freeTitle(title: string): string {
    const base = toId(title) || 'untitled'
    let name = base
    for (let n = 2; data.pages.taken(name, null); n++) name = `${base}_${n}`
    return name
  }

  save(type: WorkoutPageType, input: { id: string | null; title: string | null; data: unknown }): PageMeta {
    this.ensure()
    const value = CLEAN[type](input.data)
    if (input.id) {
      const page = data.pages.get(input.id)
      if (page.type !== type) throw new ToolError(`${page.title} is not a ${LABEL[type]}. find with kind ${type} lists them.`)
      const title = input.title?.trim()
      if (title && toId(title) !== page.title) data.pages.write({ ref: page.id, title })
      data.pages.setData(page.id, value)
      this.changed()
      return data.pages.metaFor(page.id)!
    }
    const title = input.title?.trim()
    if (!title) throw new ToolError(`Give the new ${LABEL[type]} an id.`)
    const page = data.pages.create({ title, type, data: value })
    this.changed()
    return data.pages.metaFor(page.id)!
  }

  remove(type: WorkoutPageType, ref: string): string {
    this.ensure()
    const meta = this.find(type, ref)
    const at = data.pages.pathOf(meta.id)
    data.pages.delete(meta.id)
    if (type === EXERCISE) for (const p of this.pagesOf(WORKOUT)) {
      const w = this.dataOf<WorkoutData>(WORKOUT, p.id)
      if (w.items.some((i) => i.exercise === meta.id)) data.pages.setData(p.id, { ...w, items: w.items.filter((i) => i.exercise !== meta.id) })
    }
    this.changed()
    return at
  }

  private create(type: WorkoutPageType, title: string, value: unknown): string {
    return data.pages.create({ title: this.freeTitle(title), type, data: CLEAN[type](value) }).id
  }

  private exerciseIds(): Map<string, string> {
    return new Map(this.pagesOf(EXERCISE).map((p) => [toId(p.title), p.id]))
  }

  private exerciseId(ex: ImportExercise, exercisesByName: Map<string, string>): string {
    const key = toId(ex.name)
    const known = exercisesByName.get(key)
    if (known) return known
    const id = this.create(EXERCISE, ex.name, exerciseFrom(ex))
    exercisesByName.set(key, id)
    return id
  }

  private importDay(day: ImportDay, prefix: string, exercisesByName: Map<string, string>, extra: Notes = { before: [], after: [] }): string {
    const items: WorkoutItem[] = []
    for (const ex of day.exercises ?? []) {
      const dose = parseDose(ex.dose ?? '')
      items.push({ exercise: this.exerciseId(ex, exercisesByName), sets: dose.sets, min: dose.min, max: dose.max })
    }
    const taken = prefix && data.pages.taken(day.label, null)
    return this.create(WORKOUT, taken ? `${prefix} ${day.label}` : day.label, { items, ...withNotes(extra, { before: notes(day.before), after: notes(day.after) }) })
  }

  private addNotes(workoutId: string, extra: Notes): void {
    if (data.pages.metaFor(workoutId)?.type !== WORKOUT || (!extra.before.length && !extra.after.length)) return
    const w = this.dataOf<WorkoutData>(WORKOUT, workoutId)
    data.pages.setData(workoutId, { ...w, ...withNotes(w, extra) })
  }

  private backup(label: string, pages: PageMeta[]): string {
    const dir = path.join(dataRoot, '_backup', `workout-${label}-${Date.now()}`)
    fs.mkdirSync(path.join(dir, 'pages'), { recursive: true })
    for (const p of pages) {
      const file = data.pages.fileFor(p.id)
      copyPath(file, path.join(dir, 'pages', path.basename(file)))
    }
    copyPath(DIR, path.join(dir, 'moduledata-workout'))
    return dir
  }

  private checkDays(days: ImportDay[]): void {
    for (const w of days) {
      if (!w?.label || !Array.isArray(w.exercises) || !w.exercises.length) throw new ToolError(`Workout ${w?.label || w?.id || '(unnamed)'} is missing something: each workout needs a label and a non-empty exercises list.`)
      for (const ex of w.exercises) if (!ex?.name || !ex.dose) throw new ToolError(`Each exercise needs a name and a dose like "3 x 8-12" (in ${w.label}).`)
    }
  }

  private parseJson(json: string, what: string): unknown {
    const raw = json.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
    try {
      return JSON.parse(raw)
    } catch (err) {
      throw new ToolError(`The ${what} is not valid JSON (${err instanceof Error ? err.message : String(err)}). Fix the JSON and save it again.`)
    }
  }

  private listOf(value: unknown, key: string): unknown[] {
    const list = Array.isArray(value) ? value : (value as Record<string, unknown> | null)?.[key]
    if (!Array.isArray(list) || !list.length) throw new ToolError(`Give the ${key} as {"${key}": [...]} with at least one in the list.`)
    return list
  }

  private importOldPlan(plan: OldPlan, exercisesByName: Map<string, string>): Map<string, string> {
    const days = new Map<string, string>()
    const extra = planNotes(plan)
    for (const day of plan.workouts ?? []) days.set(day.id, this.importDay(day, plan.title, exercisesByName, extra))
    return days
  }

  ensure(): void {
    if (this.converting) return
    const state = this.state()
    if (state.converted && state.version >= VERSION) return
    this.converting = true
    try {
      if (!state.converted) this.convertOld()
      else {
        if (state.version < 2) this.upgrade(state)
        if (this.state().version < 3) this.movePlanPages()
        if (this.state().version < 4) this.dropRotations()
      }
    } finally {
      this.converting = false
    }
    this.changed()
  }

  private convertOld(): void {
    const exercisesByName = new Map(this.pagesOf(EXERCISE).map((p) => [toId(p.title), p.id]))
    const saved = readOld<{ activeId?: string; plans?: OldPlan[] } | null>(OLD_PLANS, null)
    const builtin = builtinPlan as OldPlan
    const plans = [builtin, ...(saved?.plans ?? []).filter((p) => p.id !== builtin.id)]
    const made = new Map<string, Map<string, string>>()
    for (const plan of plans) made.set(plan.id, this.importOldPlan(plan, exercisesByName))
    const rows = this.readRows()
    const skipped: unknown[] = []
    for (const h of readOld<OldSession[]>(OLD_LOG, [])) {
      let target = made.get(h.plan)?.get(h.workout) ?? null
      if (!target) {
        const label = h.label ?? h.workout
        target = this.findOf(WORKOUT, label)?.id ?? this.create(WORKOUT, label, { items: [] })
      }
      for (const [name, values] of Object.entries(h.data ?? {})) {
        const key = toId(name)
        let id = exercisesByName.get(key)
        if (!id) {
          id = this.create(EXERCISE, name, {})
          exercisesByName.set(key, id)
        }
        const row = importRow({ date: h.date, exercise: id, workout: target, values }, skipped)
        if (row) rows.push(row)
      }
    }
    keepSkipped(skipped, 'old-log')
    this.writeRows(rows)
    this.saveState({ converted: true, version: VERSION })
  }

  private movePlanPages(): void {
    const pages = data.pages.ofType(OLD_PLAN)
    if (pages.length) {
      this.backup('plans-to-workouts', pages)
      for (const p of pages) {
        const raw: Record<string, unknown> = { ...((data.pages.get(p.id).data ?? {}) as Record<string, unknown>), title: p.title }
        for (const w of ids(raw.workouts)) this.addNotes(w, planNotes(raw))
      }
      for (const p of pages) data.pages.delete(p.id)
    }
    this.saveState({ ...this.state(), version: 3 })
  }

  private dropRotations(): void {
    if (fs.existsSync(OLD_ROTATIONS)) {
      const raw = readJson<unknown>(OLD_ROTATIONS, [])
      if (!Array.isArray(raw)) throw new Error(`Could not read ${path.relative(dataRoot, OLD_ROTATIONS)}: it should be a list of plans. Nothing was changed.`)
      this.backup('plans-removed', [])
      for (const plan of raw) for (const w of ids((plan as Record<string, unknown> | null)?.workouts)) this.addNotes(w, planNotes(plan))
      removePath(OLD_ROTATIONS)
    }
    this.saveState({ ...this.state(), version: 4 })
  }

  private upgrade(state: State): void {
    const sets = data.pages.ofType(OLD_SET)
    const workouts = this.pagesOf(WORKOUT)
    const backup = this.backup('before-v2', [...sets, ...workouts, ...this.pagesOf(EXERCISE), ...data.pages.ofType(OLD_PLAN)])

    const rows: WorkoutLogRow[] = []
    const skipped: unknown[] = []
    let expected = 0
    let total = 0
    const timed = new Set<string>()
    const next = new Map<string, WorkoutData>()
    for (const w of workouts) {
      const raw = (data.pages.get(w.id).data ?? {}) as { blocks?: { set?: string; doses?: Record<string, string> }[]; log?: { date?: string; data?: Record<string, unknown> }[]; items?: unknown }
      if (!Array.isArray(raw.blocks) && Array.isArray(raw.items)) continue
      const items: WorkoutItem[] = []
      for (const b of raw.blocks ?? []) {
        const setMeta = b.set ? data.pages.metaFor(b.set) : null
        if (!setMeta || setMeta.type !== OLD_SET) continue
        const exercises = ids(((data.pages.get(setMeta.id).data ?? {}) as { exercises?: unknown }).exercises)
        for (const e of exercises) {
          if (data.pages.metaFor(e)?.type !== EXERCISE) continue
          const dose = parseDose(b.doses?.[e] ?? '')
          if (dose.seconds) timed.add(e)
          items.push({ exercise: e, sets: dose.sets, min: dose.min, max: dose.max })
        }
      }
      for (const entry of raw.log ?? []) {
        for (const [exercise, values] of Object.entries(entry.data ?? {})) {
          const row = importRow({ date: entry.date, exercise, workout: w.id, values }, skipped)
          if (!row) continue
          rows.push(row)
          expected += 1
          total += row.values.reduce((a, b) => a + b, 0)
        }
      }
      next.set(w.id, { ...cleanWorkout(raw), items })
    }
    const kept = this.readRows().filter((r) => !next.has(r.workout ?? ''))
    keepSkipped(skipped, 'v2')
    this.writeRows([...kept, ...rows])
    const check = this.readRows().filter((r) => next.has(r.workout ?? ''))
    const checkTotal = check.reduce((sum, r) => sum + r.values.reduce((a, b) => a + b, 0), 0)
    if (check.length !== expected || checkTotal !== total) {
      throw new Error(`Seven could not move your workout history to the new layout (${check.length} of ${expected} entries checked out). Nothing else was changed; your workout data from before is kept in ${backup}. Restart Seven to try again.`)
    }
    for (const [id, value] of next) data.pages.setData(id, value)
    for (const id of timed) data.pages.setData(id, { ...cleanExercise(data.pages.get(id).data), unit: 'seconds' })
    for (const s of sets) data.pages.delete(s.id)
    this.saveState({ ...state, version: 2 })
  }

  exercise(id: string, item: WorkoutItem | null = null): WorkoutExercise {
    const page = data.pages.get(id)
    return { id: page.id, name: page.title, image: page.image ?? null, sets: item?.sets ?? 3, min: item?.min ?? 8, max: item?.max ?? 12, ...cleanExercise(page.data) }
  }

  day(id: string): WorkoutDay {
    const meta = data.pages.metaFor(id)
    if (!meta || meta.type !== WORKOUT) throw new ToolError(`No workout ${id}. find with kind workout lists them.`)
    const w = this.dataOf<WorkoutData>(WORKOUT, id)
    return { id, label: meta.title, before: w.before, after: w.after, exercises: w.items.filter((i) => data.pages.metaFor(i.exercise)?.type === EXERCISE).map((i) => this.exercise(i.exercise, i)) }
  }

  sessions(rows: WorkoutLogRow[] = this.rows()): WorkoutSession[] {
    const out = new Map<string, WorkoutSession>()
    for (const r of rows) {
      const key = `${r.date}|${r.workout ?? ''}`
      const session = out.get(key) ?? { date: r.date, workout: r.workout, label: r.workout ? (data.pages.metaFor(r.workout)?.title ?? '(deleted workout)') : 'no workout', rows: [] }
      const ex = data.pages.metaFor(r.exercise)
      const unit = ex ? cleanExercise(data.pages.get(r.exercise).data).unit : ''
      session.rows.push({ exercise: r.exercise, name: ex?.title ?? '(deleted exercise)', unit, values: r.values })
      out.set(key, session)
    }
    return [...out.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  }

  findWorkout(ref: string | null): WorkoutDay {
    if (!ref?.trim()) throw new ToolError('Say which workout. find with kind workout lists them.')
    return this.day(this.find(WORKOUT, ref).id)
  }

  lastFor(exerciseId: string, rows: WorkoutLogRow[] = this.rows(), before: string | null = null): { date: string; values: number[] } | null {
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i]
      if (r.exercise === exerciseId && (!before || r.date < before)) return { date: r.date, values: r.values }
    }
    return null
  }

  overview(): WorkoutOverview {
    const rows = this.rows()
    const last: WorkoutOverview['last'] = {}
    for (const p of this.pagesOf(EXERCISE)) {
      const h = this.lastFor(p.id, rows)
      if (h) last[p.id] = h
    }
    const workouts = this.pagesOf(WORKOUT).map((p) => this.day(p.id))
    return { workouts, last, history: this.sessions(rows).slice(-60).reverse(), today: today() }
  }

  history(): WorkoutHistory {
    const rows = this.rows()
    const targets: WorkoutHistory['targets'] = {}
    for (const p of this.pagesOf(WORKOUT)) {
      const own: Record<string, { sets: number; min: number; max: number }> = {}
      for (const i of this.dataOf<WorkoutData>(WORKOUT, p.id).items) if (!own[i.exercise]) own[i.exercise] = { sets: i.sets, min: i.min, max: i.max }
      targets[p.id] = own
    }
    return {
      rows,
      exercises: this.pagesOf(EXERCISE).map((p) => ({ id: p.id, name: p.title, ...this.unitAndMuscles(p.id) })),
      workouts: this.pagesOf(WORKOUT).map((p) => ({ id: p.id, name: p.title })),
      targets
    }
  }

  logExercise(date: string, exerciseRef: string, values: number[], workoutRef: string | null): string {
    this.ensure()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ToolError(`Give date as YYYY-MM-DD, e.g. ${today()}.`)
    const ex = this.find(EXERCISE, exerciseRef)
    const workoutId = workoutRef ? this.find(WORKOUT, workoutRef).id : null
    if (!values.length) throw new ToolError('Give values, the numbers done per set, e.g. [12, 10, 9].')
    const rows = this.rows()
    const same = (r: WorkoutLogRow) => r.date === date && r.exercise === ex.id && r.workout === workoutId
    const existing = rows.find(same)
    const row = checkRow({ date, exercise: ex.id, workout: workoutId, values: [...(existing?.values ?? []), ...values] })
    if (typeof row === 'string') throw new ToolError(`Give values as numbers of 0 or more, one per set: ${row}.`)
    const before = this.lastFor(ex.id, rows.filter((r) => !(r.date === date && r.exercise === ex.id)), null)
    this.writeRows([...rows.filter((r) => !same(r)), row])
    this.changed()
    const sum = (v: number[]) => v.reduce((a, b) => a + b, 0)
    const trend = !before ? 'first time logged' : sum(row.values) > sum(before.values) ? `up from ${valuesText(before.values)}` : sum(row.values) < sum(before.values) ? `down from ${valuesText(before.values)}` : 'same as last time'
    const item = workoutId ? this.dataOf<WorkoutData>(WORKOUT, workoutId).items.find((i) => i.exercise === ex.id) : undefined
    const ready = item && row.values.length >= item.sets && row.values.every((v) => v >= item.max) ? ' Every set reached the top of the target.' : ''
    const added = existing ? `, added to the ${existing.values.length} set${existing.values.length === 1 ? '' : 's'} already logged that day (${valuesText(row.values)} in all)` : ''
    return `Logged exercise ${ex.title} on ${date}: ${valuesText(values)}${added} (${trend}).${ready}`
  }

  record(workoutRef: string, date: string, given: Record<string, number[]>): string {
    const w = this.findWorkout(workoutRef)
    const lines = Object.entries(given)
      .filter(([, v]) => Array.isArray(v) && v.length)
      .map(([exercise, values]) => {
        this.setLog(date, exercise, w.id, values)
        return `Logged exercise ${this.find(EXERCISE, exercise).title} on ${date}: ${valuesText(values)}.`
      })
    if (!lines.length) throw new ToolError('Fill in at least one set.')
    return lines.join('\n')
  }

  removeLog(date: string, exerciseRef: string): string {
    this.ensure()
    const ex = this.find(EXERCISE, exerciseRef)
    const rows = this.rows()
    const left = rows.filter((r) => !(r.date === date && r.exercise === ex.id))
    if (left.length === rows.length) throw new ToolError(`Nothing is logged for exercise ${ex.title} on ${date}. workout_history lists what is.`)
    this.writeRows(left)
    this.changed()
    return `Removed exercise ${ex.title} on ${date} from the log.`
  }

  setLog(date: string, exerciseRef: string, workoutId: string | null, values: number[]): void {
    this.ensure()
    const ex = this.find(EXERCISE, exerciseRef)
    const rows = this.rows().filter((r) => !(r.date === date && r.exercise === ex.id && r.workout === workoutId))
    if (!values.length) {
      this.writeRows(rows)
      this.changed()
      return
    }
    const row = checkRow({ date, exercise: ex.id, workout: workoutId, values })
    if (typeof row === 'string') throw new ToolError(`Give values as numbers of 0 or more, one per set: ${row}.`)
    this.writeRows([...rows, row])
    this.changed()
  }

  deleteDay(date: string): void {
    this.ensure()
    this.writeRows(this.rows().filter((r) => r.date !== date))
    this.changed()
  }

  patchExercise(exerciseRef: string, patch: { unit?: string; muscles?: string[] }): void {
    const ex = this.find(EXERCISE, exerciseRef)
    const current = cleanExercise(data.pages.get(ex.id).data)
    data.pages.setData(ex.id, { ...current, ...(patch.unit !== undefined ? { unit: patch.unit.trim() || 'reps' } : {}), ...(patch.muscles !== undefined ? { muscles: muscleList(patch.muscles) } : {}) })
    this.changed()
  }

  private unitAndMuscles(id: string): { unit: string; muscles: string[] } {
    const e = cleanExercise(data.pages.get(id).data)
    return { unit: e.unit, muscles: e.muscles }
  }

  deleteSession(workoutId: string | null, date: string): void {
    this.ensure()
    this.writeRows(this.rows().filter((r) => !(r.date === date && r.workout === workoutId)))
    this.changed()
  }

  saveWorkouts(json: string): string[] {
    this.ensure()
    const list = this.listOf(this.parseJson(json, 'workouts'), 'workouts') as ImportDay[]
    this.checkDays(list)
    const byName = this.exerciseIds()
    const made = list.map((day) => this.importDay(day, 'workout', byName))
    this.changed()
    return made.map((id) => data.pages.metaFor(id)!.title)
  }

  saveExercises(json: string): { added: string[]; existing: string[] } {
    this.ensure()
    const list = this.listOf(this.parseJson(json, 'exercises'), 'exercises') as ImportExercise[]
    for (const ex of list) if (!ex?.name || typeof ex.name !== 'string') throw new ToolError('Each exercise needs a name.')
    const byName = this.exerciseIds()
    const added: string[] = []
    const existing: string[] = []
    for (const ex of list) {
      const known = byName.has(toId(ex.name))
      this.exerciseId(ex, byName)
      if (known) existing.push(ex.name)
      else added.push(ex.name)
    }
    this.changed()
    return { added, existing }
  }

  read(type: WorkoutPageType, id: string): string {
    this.ensure()
    const meta = data.pages.metaFor(id)
    if (!meta) throw new ToolError(`No ${type} ${id}. find with kind ${type} lists them.`)
    const ref = (pid: string, kind: string) => (data.pages.metaFor(pid) ? `${kind} ${data.pages.pathOf(pid)}` : '(deleted)')
    if (type === EXERCISE) {
      const e = this.exercise(id)
      const used = this.pagesOf(WORKOUT).filter((w) => this.dataOf<WorkoutData>(WORKOUT, w.id).items.some((i) => i.exercise === id))
      const last = this.lastFor(id)
      return [
        `Measured in ${unitText(e)}.`,
        e.muscles.length ? `Works: ${e.muscles.join(', ')}.` : '',
        e.how.length ? `## How to do it\n${e.how.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : '',
        e.dos.length ? `## Do\n${e.dos.map((s) => `- ${s}`).join('\n')}` : '',
        e.donts.length ? `## Don't\n${e.donts.map((s) => `- ${s}`).join('\n')}` : '',
        e.easier ? `## Easier version\n${e.easier}` : '',
        `## Visual\n${[e.figures.length ? `${e.figures.length} drawing${e.figures.length === 1 ? '' : 's'}` : '', e.image ? 'a picture' : '', e.video ? `video ${e.video}` : ''].filter(Boolean).join(', ') || 'none yet'}`,
        used.length ? `In: ${used.map((w) => ref(w.id, WORKOUT)).join(', ')}` : '',
        last ? `Last logged ${last.date}: ${valuesText(last.values)}` : 'Not logged yet.'
      ]
        .filter(Boolean)
        .join('\n\n')
    }
    const d = this.day(id)
    const rows = this.rows()
    const noteText = (list: WorkoutNote[]) => list.map((n) => `${n.title}${n.title && n.text ? ': ' : ''}${n.text}`).join('\n')
    return [
      d.before.length ? `## Before\n${noteText(d.before)}` : '',
      d.exercises.map((e) => {
        const last = this.lastFor(e.id, rows)
        return `- ${ref(e.id, EXERCISE)}: ${doseText(e, e.unit)}${last ? ` (last ${last.date}: ${valuesText(last.values)})` : ''}`
      }).join('\n') || 'No exercises yet.',
      d.after.length ? `## After\n${noteText(d.after)}` : ''
    ]
      .filter(Boolean)
      .join('\n\n')
  }
}

export const workout = new WorkoutStore()
