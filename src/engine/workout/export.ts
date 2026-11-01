import type { WorkoutHistory } from '@shared/types'
import type { ExportBlock, ExportPart } from '@shared/exporting'
import { valuesText, targetText } from '@shared/workout'
import {
  STATS_RANGES,
  growth,
  headline,
  muscleStats,
  overdue,
  periodFor,
  targetStats,
  type Period,
  type StatsRange
} from '@shared/workoutInsights'
import { data } from '../data/hub'
import { registerExport, type ExportSection } from '../exporting/registry'
import { IMPORT_FORMATS, cleanExercise, today, workout } from './store'

interface Ctx {
  range: StatsRange
  today: string
  period: Period
  history: WorkoutHistory
  name: (id: string) => string
  workoutName: (id: string) => string
  unit: (id: string) => string
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const withUnit = (text: string, unit: string) => (unit.trim() ? `${text} ${unit.trim()}` : text)
const percent = (n: number | null) =>
  n === null ? 'no change measured' : `${n >= 0 ? '+' : ''}${Math.round(n * 100)}%`

function context(range: StatsRange): Ctx {
  const history = workout.history()
  const day = today()
  const exercises = new Map(history.exercises.map((e) => [e.id, e]))
  const workouts = new Map(history.workouts.map((w) => [w.id, w.name]))
  return {
    range,
    today: day,
    period: periodFor(range, day, history.rows),
    history,
    name: (id) => exercises.get(id)?.name ?? `removed exercise ${id}`,
    workoutName: (id) => workouts.get(id) ?? `removed workout ${id}`,
    unit: (id) => exercises.get(id)?.unit ?? ''
  }
}

function inPeriod(ctx: Ctx) {
  return ctx.history.rows.filter((r) => r.date >= ctx.period.from && r.date <= ctx.period.to)
}

function summary(ctx: Ctx): ExportPart {
  const { history, period } = ctx
  const head = headline(history.rows, period, ctx.today)
  const grow = growth(history, period)
  const late = overdue(
    history.rows,
    history.exercises.map((e) => e.id),
    ctx.today
  )
  const muscles = muscleStats(history, period)
  const targets = targetStats(history, period)
  const blocks: ExportBlock[] = [
    {
      li: `Trained ${head.perWeek.toFixed(1)} days a week${head.perWeekBefore === null ? '' : ` (${head.perWeekBefore.toFixed(1)} in the same length of time before)`}`
    },
    {
      li: head.longestBreak
        ? `Longest break: ${plural(head.longestBreak.days, 'day')}, ${head.longestBreak.from} to ${head.longestBreak.to}`
        : 'No breaks of more than a day'
    },
    {
      li:
        head.sinceLast === null
          ? 'Nothing logged yet'
          : `Last trained ${plural(head.sinceLast, 'day')} ago${head.usualGap === null ? '' : `; usually ${plural(Math.round(head.usualGap), 'day')} between sessions`}`
    },
    {
      li: `${plural(head.bests, 'new personal best')} on ${plural(head.bestExercises, 'exercise')}`
    },
    {
      h: 'Growth per exercise (its first third of sessions in the period against its last third, worst first)'
    },
    ...grow.map((g) => ({
      li: `${ctx.name(g.id)}: best set ${g.bestThen} → ${withUnit(String(g.bestNow), ctx.unit(g.id))}, day total ${g.totalThen} → ${g.totalNow} (${percent(g.change)}), ${plural(g.sinceBest, 'session')} since a best`
    })),
    { h: 'Against how often each exercise is usually done' },
    ...late.map((o) => ({
      li: `${ctx.name(o.id)}: last done ${plural(o.sinceLast, 'day')} ago, usually every ${plural(o.usual, 'day')}${o.overdue > 0 ? `, ${plural(o.overdue, 'day')} overdue` : ''}`
    })),
    { h: 'Sets per muscle in the period, fewest first' },
    ...muscles.muscles.map((m) => ({
      li: `${m.muscle}: ${plural(m.sets, 'set')}, last worked ${m.last ?? 'never'}`
    })),
    ...(muscles.untagged.length
      ? [{ p: `Exercises with no muscles filled in: ${muscles.untagged.join(', ')}.` }]
      : []),
    { h: 'Sets that reached the bottom of the workout target' },
    ...targets.map((t) => ({
      li: `${ctx.name(t.id)} in ${ctx.workoutName(t.workout)}: target ${targetText(t.min, t.max)}, ${Math.round((t.hit / t.sets) * 100)}% of ${plural(t.sets, 'set')}`
    }))
  ]
  return {
    heading: `Summary, ${period.from} to ${period.to}`,
    blocks,
    json: {
      from: period.from,
      to: period.to,
      headline: head,
      growth: grow.map(({ id, sessions: _sessions, ...g }) => ({ exercise: ctx.name(id), ...g })),
      overdue: late.map(({ id, ...o }) => ({ exercise: ctx.name(id), ...o })),
      muscles,
      targets: targets.map(({ id, workout: w, ...t }) => ({
        exercise: ctx.name(id),
        workout: ctx.workoutName(w),
        ...t
      }))
    }
  }
}

function log(ctx: Ctx): ExportPart {
  const rows = inPeriod(ctx)
  const days = [...new Set(rows.map((r) => r.date))].map((date) => ({
    date,
    exercises: rows
      .filter((r) => r.date === date)
      .map((r) => ({
        exercise: ctx.name(r.exercise),
        workout: r.workout ? ctx.workoutName(r.workout) : null,
        unit: ctx.unit(r.exercise),
        sets: r.values,
        total: r.values.reduce((n, v) => n + v, 0)
      }))
  }))
  return {
    heading: `Log, ${ctx.period.from} to ${ctx.period.to}`,
    blocks: days.length
      ? days.flatMap((d) => [
          { h: d.date },
          ...d.exercises.map((e) => ({
            li: `${e.exercise}${e.workout ? ` (${e.workout})` : ''}: ${withUnit(valuesText(e.sets), e.unit)}, total ${e.total}`
          }))
        ])
      : [{ p: 'Nothing logged in this period.' }],
    json: days
  }
}

function exercises(ctx: Ctx): ExportPart {
  const list = ctx.history.exercises.map((e) => ({
    name: e.name,
    unit: e.unit,
    muscles: e.muscles
  }))
  return {
    heading: 'Exercises',
    blocks: list.map((e) => ({
      li: `${e.name}, counted in ${e.unit}${e.muscles.length ? `. Works: ${e.muscles.join(', ')}` : ''}`
    })),
    json: list
  }
}

function guideOf(id: string) {
  const g = cleanExercise(data.pages.get(id).data)
  return { how: g.how, dos: g.dos, donts: g.donts, easier: g.easier }
}

const hasGuide = (g: ReturnType<typeof guideOf>) =>
  Boolean(g.how.length || g.dos.length || g.donts.length || g.easier)

function guides(ctx: Ctx): ExportPart {
  const list = ctx.history.exercises
    .map((e) => ({ name: e.name, ...guideOf(e.id) }))
    .filter(hasGuide)
  return {
    heading: 'Exercise guides',
    blocks: list.length
      ? list.flatMap((g) => [
          { h: g.name },
          ...g.how.map((line, i) => ({ li: `${i + 1}. ${line}` })),
          ...g.dos.map((line) => ({ li: `Do: ${line}` })),
          ...g.donts.map((line) => ({ li: `Don't: ${line}` })),
          ...(g.easier ? [{ li: `Easier: ${g.easier}` }] : [])
        ])
      : [{ p: 'No exercise has a guide yet.' }],
    json: list
  }
}

function workoutsPart(ctx: Ctx): ExportPart {
  const workouts = ctx.history.workouts.map((w) => ({
    name: w.name,
    exercises: Object.entries(ctx.history.targets[w.id] ?? {}).map(([id, t]) => ({
      exercise: ctx.name(id),
      sets: t.sets,
      target: targetText(t.min, t.max),
      unit: ctx.unit(id)
    }))
  }))
  return {
    heading: 'Workouts',
    blocks: [
      ...workouts.flatMap((w) => [
        { h: w.name },
        ...w.exercises.map((e) => ({
          li: `${e.exercise}: ${e.sets} sets of ${withUnit(e.target, e.unit)}`
        }))
      ])
    ],
    json: { workouts }
  }
}

function howToAnswer(): ExportPart {
  return {
    heading: 'How to answer',
    blocks: [
      {
        p: 'If your answer gives me workouts or exercises, put each in a JSON block in the matching shape below so I can import it into Seven, my workout tracker. Explain your reasoning outside the JSON.'
      },
      ...IMPORT_FORMATS.flatMap((f) => [
        { h: `For ${f.what}` },
        { pre: f.shape },
        ...f.rules.map((r) => ({ li: r.replace(/^- /, '') }))
      ])
    ],
    json: IMPORT_FORMATS
  }
}

const SECTIONS: ExportSection<Ctx>[] = [
  {
    id: 'summary',
    label: 'Summary',
    hint: 'days per week, breaks, bests, growth and overdue per exercise, sets per muscle, targets hit',
    on: true,
    size: (ctx) => plural(summary(ctx).blocks.length, 'line'),
    build: summary
  },
  {
    id: 'log',
    label: 'Log',
    hint: 'every day in the period: exercise, workout, each set, total',
    on: true,
    size: (ctx) => plural(new Set(inPeriod(ctx).map((r) => r.date)).size, 'day'),
    build: log
  },
  {
    id: 'exercises',
    label: 'Exercises',
    hint: 'unit and the muscles each one works',
    on: true,
    size: (ctx) => String(ctx.history.exercises.length),
    build: exercises
  },
  {
    id: 'guides',
    label: 'Exercise guides',
    hint: "how to do each one, dos, don'ts, easier version",
    on: false,
    size: (ctx) =>
      `${ctx.history.exercises.filter((e) => hasGuide(guideOf(e.id))).length} with guides`,
    build: guides
  },
  {
    id: 'workouts',
    label: 'Workouts',
    hint: "each workout's exercises and targets",
    on: true,
    size: (ctx) => plural(ctx.history.workouts.length, 'workout'),
    build: workoutsPart
  },
  {
    id: 'answer',
    label: 'How to answer',
    hint: 'the formats Seven imports, so workouts or exercises it writes can be pasted straight in',
    on: true,
    size: () => plural(IMPORT_FORMATS.length, 'format'),
    build: howToAnswer
  }
]

export function registerWorkoutExport(): void {
  registerExport<Ctx>('workout', {
    options: [
      {
        id: 'range',
        label: 'Period',
        choices: STATS_RANGES.map((r) => ({ value: r.value, label: r.label })),
        initial: '3m'
      }
    ],
    presets: [
      {
        id: 'review',
        label: 'Review my progress',
        brief:
          "Look at how my training has gone. Tell me where I'm improving, where I've stalled or slacked, and what I'm neglecting, and what to change.",
        sections: ['summary', 'log', 'exercises', 'workouts']
      },
      {
        id: 'design',
        label: 'Design new workouts',
        brief: 'Design new workouts for me that build on what I already do.',
        sections: ['summary', 'exercises', 'workouts', 'answer']
      },
      {
        id: 'change',
        label: 'Change a workout',
        brief: 'Change my workouts so I keep progressing.',
        sections: ['summary', 'log', 'exercises', 'workouts', 'answer']
      },
      {
        id: 'guides',
        label: 'Write exercise guides',
        brief:
          'Write clear guides for my exercises: how to do each, what to do and avoid, and an easier version.',
        sections: ['exercises', 'guides', 'answer']
      }
    ],
    sections: SECTIONS,
    context: (_args, options) => context(options.range as StatsRange),
    title: (ctx) => `workout ${ctx.period.from} to ${ctx.period.to}`,
    subtitle: (ctx) =>
      `${STATS_RANGES.find((r) => r.value === ctx.range)?.label ?? ''}: ${ctx.period.from} to ${ctx.period.to}`
  })
}
