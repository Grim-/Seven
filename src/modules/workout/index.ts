import path from 'node:path'
import type { ModuleFactory } from '../../engine/modules/sdk'
import { ToolError, optStr, str, type ToolContext, type ToolDef } from '../../engine/tools/types'
import { EXERCISE, WORKOUT, cleanExercise, cleanWorkout, today, workout } from '../../engine/workout/store'
import { data } from '../../engine/data/hub'
import { writer } from '../../engine/present/places'
import { toId } from '@shared/ids'
import { linkFor } from '@shared/text'
import { valuesText } from '@shared/workout'
import type { WorkoutItem } from '@shared/types'
import { dayOf } from '../../engine/util/when'
import { canShowPaths, registerShownFile } from '../../engine/tools/shown'
import { pathExists } from '../read/tools'
import { registerGlance } from '../../engine/data/glances'

registerGlance({ id: 'workout', label: 'Workout', module: 'workout' })

const LIST = { type: 'array', items: { type: 'string' } } as const
const IMAGE = {
  type: 'object',
  properties: {
    source: { enum: ['file', 'url', 'none'] },
    value: { type: 'string', description: 'A file id or path, or an https link to a picture' }
  }
} as const
const ITEMS = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      exercise: { type: 'string' },
      sets: { type: 'integer' },
      min: { type: 'integer', description: 'Lowest target per set' },
      max: { type: 'integer', description: 'Highest target per set' }
    }
  }
} as const

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean) : []
}

function dateOf(params: Record<string, unknown>): string {
  const raw = optStr(params, 'date')
  const day = raw ? dayOf(raw) : today()
  if (!day) throw new ToolError(`date ${raw} is not a day. Give YYYY-MM-DD, e.g. ${today()}, or today.`)
  return day
}

async function picture(raw: unknown, id: string, ctx: ToolContext): Promise<string | null> {
  const image = raw && typeof raw === 'object' ? (raw as { source?: string; value?: string }) : null
  if (!image || image.source === 'none') return null
  const value = String(image.value ?? '').trim()
  if (image.source === 'file') {
    if (data.assets.exists(value)) return value
    if (canShowPaths(ctx) && pathExists(value, ctx)) return registerShownFile(value, ctx)
    throw new ToolError(`No file ${value}. Give a file id from the user's attachments, or a path in your workspace or a linked folder.`)
  }
  if (!/^https:\/\//i.test(value)) throw new ToolError('Give value as an https link to a picture, e.g. https://example.com/plank.png.')
  const p = ctx.permissions.toolPermission
  const alreadyAsked = p === 'always' || (p === 'ask' && ctx.permissions.mode !== 'trusted')
  if (p !== 'none' && !alreadyAsked) {
    const ok = await ctx.ui.ask('confirm', { message: `Download the picture at ${value} for exercise ${id}?`, confirmLabel: 'Download', cancelLabel: 'Cancel' })
    if (ok !== true) throw new ToolError('The user did not allow downloading that picture. Carry on without it, or ask the user for a picture.')
  }
  let res: Response
  try {
    res = await fetch(value, { signal: ctx.signal })
  } catch (err) {
    throw new ToolError(`Could not download ${value} (${err instanceof Error ? err.message : String(err)}). Check the link, or use another picture.`)
  }
  const type = res.headers.get('content-type') ?? ''
  if (!res.ok || !type.startsWith('image/')) throw new ToolError(`${value} is not a picture (${res.ok ? type || 'unknown type' : `status ${res.status}`}). Give a link straight to an image file.`)
  const name = path.basename(new URL(value).pathname) || `${id}.${type.split('/')[1] ?? 'png'}`
  return data.assets.registerBytes(name, Buffer.from(await res.arrayBuffer()), { tool: 'add_exercise', sessionId: ctx.sessionId, original: value }, writer(ctx)).id
}

function items(value: unknown): WorkoutItem[] {
  const list = Array.isArray(value) ? value : []
  return list.map((raw, i) => {
    const d = (raw ?? {}) as Record<string, unknown>
    const ref = String(d.exercise ?? '').trim()
    if (!ref) throw new ToolError(`exercises item ${i + 1} has no exercise. Give an exercise id, e.g. push_ups.`)
    const id = workout.find(EXERCISE, ref).id
    return { exercise: id, sets: Number(d.sets), min: Number(d.min), max: Number(d.max) }
  })
}

function exerciseData(params: Record<string, unknown>, figures: string[]) {
  return cleanExercise({
    how: strings(params.how),
    dos: strings(params.do),
    donts: strings(params.dont),
    easier: optStr(params, 'easier') ?? '',
    video: optStr(params, 'video'),
    unit: optStr(params, 'unit') ?? '',
    muscles: strings(params.muscles),
    figures
  })
}

const exerciseProps = {
  id: { type: 'string' },
  how: { ...LIST, description: 'Steps, in order' },
  do: LIST,
  dont: LIST,
  easier: { type: ['string', 'null'], description: 'An easier version' },
  unit: { type: 'string', description: 'What one number means, e.g. reps per arm' },
  muscles: { ...LIST, description: 'Muscles it works, e.g. chest, triceps' },
  video: { type: ['string', 'null'], description: 'An https video link' }
} as const

const addExercise: ToolDef = {
  name: 'add_exercise',
  group: 'workout',
  needsWorkspace: false,
  description: 'Add an exercise.',
  params: { type: 'object', properties: { ...exerciseProps, image: { oneOf: [{ type: 'null' }, IMAGE] }, drawings: { ...LIST, description: 'Stick-figure <svg> drawings' } } },
  async execute(params, ctx) {
    const id = toId(str(params, 'id'))
    if (data.pages.findPath(id)) throw new ToolError(`${id} already exists. update_exercise changes an exercise.`)
    const figures = strings(params.drawings)
    const value = exerciseData(params, figures)
    if (value.figures.length !== figures.length) throw new ToolError('A drawing was not a valid <svg>…</svg>. Give complete <svg> elements with no scripts.')
    const image = await picture(params.image, id, ctx)
    const meta = workout.save(EXERCISE, { id: null, title: id, data: value })
    if (image) data.pages.setImage(meta.id, image, writer(ctx))
    return `Added exercise ${meta.title} · link ${linkFor('exercise', meta.title)}.`
  }
}

const updateExercise: ToolDef = {
  name: 'update_exercise',
  group: 'workout',
  needsWorkspace: false,
  description: 'Replace an exercise.',
  params: { type: 'object', properties: { ...exerciseProps, image: { oneOf: [{ type: 'null' }, IMAGE], description: 'null keeps the picture it has' } } },
  async execute(params, ctx) {
    const meta = workout.find(EXERCISE, str(params, 'id'))
    const current = cleanExercise(data.pages.get(meta.id).data)
    const image = params.image ? await picture(params.image, meta.title, ctx) : undefined
    workout.save(EXERCISE, { id: meta.id, title: null, data: exerciseData(params, current.figures) })
    if (image !== undefined) data.pages.setImage(meta.id, image, writer(ctx))
    return `Updated exercise ${meta.title}.`
  }
}

const removeExercise: ToolDef = {
  name: 'remove_exercise',
  group: 'workout',
  needsWorkspace: false,
  description: 'Remove an exercise. Its logged sets stay in the history.',
  params: { type: 'object', properties: { id: { type: 'string' } } },
  async execute(params) {
    return `Removed exercise ${workout.remove(EXERCISE, str(params, 'id'))}.`
  }
}

const NOTES = { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, text: { type: 'string' } } } } as const

const workoutProps = {
  id: { type: 'string' },
  exercises: ITEMS,
  before: { ...NOTES, description: 'Notes shown above the workout, e.g. a warm-up' },
  after: { ...NOTES, description: 'Notes shown below the workout, e.g. a cool-down' }
} as const

const addWorkout: ToolDef = {
  name: 'add_workout',
  group: 'workout',
  needsWorkspace: false,
  description: 'Add a workout.',
  params: { type: 'object', properties: workoutProps },
  async execute(params) {
    const id = toId(str(params, 'id'))
    if (data.pages.findPath(id)) throw new ToolError(`${id} already exists. update_workout changes a workout.`)
    const meta = workout.save(WORKOUT, { id: null, title: id, data: { items: items(params.exercises), before: params.before, after: params.after } })
    return `Added workout ${meta.title} · link ${linkFor('workout', meta.title)}.`
  }
}

const updateWorkout: ToolDef = {
  name: 'update_workout',
  group: 'workout',
  needsWorkspace: false,
  description: "Replace a workout's exercises, and its before and after notes when given.",
  params: { type: 'object', properties: workoutProps },
  async execute(params) {
    const meta = workout.find(WORKOUT, str(params, 'id'))
    const current = cleanWorkout(data.pages.get(meta.id).data)
    workout.save(WORKOUT, { id: meta.id, title: null, data: { items: items(params.exercises), before: params.before ?? current.before, after: params.after ?? current.after } })
    return `Updated workout ${meta.title}: ${cleanWorkout(data.pages.get(meta.id).data).items.length} exercises.`
  }
}

const removeWorkout: ToolDef = {
  name: 'remove_workout',
  group: 'workout',
  needsWorkspace: false,
  description: 'Remove a workout. Its logged sets stay in the history.',
  params: { type: 'object', properties: { id: { type: 'string' } } },
  async execute(params) {
    return `Removed workout ${workout.remove(WORKOUT, str(params, 'id'))}.`
  }
}

const logExercise: ToolDef = {
  name: 'log_exercise',
  group: 'workout',
  needsWorkspace: false,
  description: 'Log what was done of an exercise on a day.',
  params: {
    type: 'object',
    properties: {
      date: { type: 'string', description: 'YYYY-MM-DD, or today' },
      exercise: { type: 'string' },
      values: { type: 'array', items: { type: 'number' }, description: 'One number per set' },
      workout: { type: ['string', 'null'], description: 'The workout it was part of' }
    }
  },
  async execute(params) {
    const values = Array.isArray(params.values) ? params.values.map(Number) : []
    return workout.logExercise(dateOf(params), str(params, 'exercise'), values, optStr(params, 'workout'))
  }
}

const removeLog: ToolDef = {
  name: 'remove_log',
  group: 'workout',
  needsWorkspace: false,
  description: 'Remove what was logged for an exercise on a day.',
  params: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD' }, exercise: { type: 'string' } } },
  async execute(params) {
    return workout.removeLog(dateOf(params), str(params, 'exercise'))
  }
}

const history: ToolDef = {
  name: 'workout_history',
  group: 'workout',
  needsWorkspace: false,
  description: 'The workout log between two days, one line per exercise per day.',
  params: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'YYYY-MM-DD' },
      to: { type: 'string', description: 'YYYY-MM-DD, or today' },
      exercise: { type: ['string', 'null'], description: 'Only this exercise' }
    }
  },
  async execute(params) {
    const from = dayOf(str(params, 'from'))
    const to = dayOf(str(params, 'to'))
    if (!from || !to) throw new ToolError(`Give from and to as YYYY-MM-DD, e.g. from 2026-10-01 to ${today()}.`)
    const only = optStr(params, 'exercise')
    const exercise = only ? workout.find(EXERCISE, only).id : null
    const rows = workout.rows().filter((r) => r.date >= from && r.date <= to && (!exercise || r.exercise === exercise))
    if (!rows.length) return { text: `Nothing logged from ${from} to ${to}${exercise ? ` for exercise ${toId(only ?? '')}` : ''}.`, empty: true }
    const name = (id: string) => data.pages.metaFor(id)?.title ?? '(removed)'
    return rows.map((r) => `${r.date} exercise ${name(r.exercise)}: ${valuesText(r.values)}${r.workout ? ` (workout ${name(r.workout)})` : ''}`).join('\n')
  }
}

const show: ToolDef = {
  name: 'workout_show',
  group: 'workout',
  needsWorkspace: false,
  maxRepeats: 1,
  description: 'Show a workout, or the history, in the chat.',
  params: { type: 'object', properties: { workout: { type: ['string', 'null'], description: 'A workout id; null with view history' }, view: { enum: ['workout', 'history'] } } },
  async execute(params) {
    if (params.view === 'history') return { text: 'Shown: the workout history.', view: { kind: 'workout', title: 'Workout history', data: { mode: 'history', workout: null } } }
    const w = workout.findWorkout(optStr(params, 'workout'))
    return { text: `Shown: workout ${w.label}.`, view: { kind: 'workout', title: w.label, data: { mode: 'workout', workout: w.id } } }
  }
}

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(tools: { add(tool: ToolDef): void }): void {
      for (const tool of [show, history, logExercise, removeLog, addExercise, updateExercise, removeExercise, addWorkout, updateWorkout, removeWorkout]) tools.add(tool)
    }
  }

export default factory
