import { createElement, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, FolderOpen, Maximize2, Save, Trash2, Video, X } from 'lucide-react'
import { doseText, valuesText } from '@shared/workout'
import type { WorkoutDay, WorkoutExercise, WorkoutNote, WorkoutOverview, WorkoutPageType, WorkoutViewData } from '@shared/types'
import { engine, on } from '../../lib/ipc'
import { registerGlanceView } from '../../registries/glances'
import { errorText } from '../../lib/format'
import { toast } from '../../store/toasts'
import { useApp } from '../../store/app'
import { assetUrl, useData } from '../../store/data'
import { AlertBox, Button, EmptyState, Input, Panel, ShellTabs, askText, openMenu, confirmDelete } from '../ui'
import { Markdown } from '../chat/Markdown'
import { showBrowser } from '../side/BrowserTab'
import { onLibraryChange } from '../../lib/library'
import { cn } from '../../lib/cn'
import { showName } from '@shared/ids'
import { entryMenuAt } from '../../views/data/entryMenu'
import { showInData } from '../../lib/library'

const HISTORY = '_history'
const drafts = new Map<string, string[]>()
const dates = new Map<string, string>()

export function lastDone(overview: WorkoutOverview): WorkoutDay | undefined {
  const last = overview.history.find((s) => s.workout && overview.workouts.some((w) => w.id === s.workout))
  return overview.workouts.find((w) => w.id === last?.workout)
}

export function useWorkout(): { overview: WorkoutOverview | null; error: string | null } {
  const [overview, setOverview] = useState<WorkoutOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    const load = () =>
      void engine('workout.overview')
        .then((o) => live && (setOverview(o), setError(null)))
        .catch((err) => live && setError(errorText(err)))
    load()
    const off = on('workout.changed', load)
    const offLibrary = onLibraryChange(load)
    return () => {
      live = false
      off()
      offLibrary()
    }
  }, [])
  return { overview, error }
}

const SVG_TAGS = new Set(['svg', 'g', 'line', 'circle', 'ellipse', 'path', 'rect', 'polyline', 'polygon', 'text', 'tspan'])
const SVG_ATTRS: Record<string, string> = {
  viewBox: 'viewBox',
  x: 'x',
  y: 'y',
  x1: 'x1',
  y1: 'y1',
  x2: 'x2',
  y2: 'y2',
  cx: 'cx',
  cy: 'cy',
  r: 'r',
  rx: 'rx',
  ry: 'ry',
  d: 'd',
  points: 'points',
  width: 'width',
  height: 'height',
  transform: 'transform',
  class: 'className',
  'text-anchor': 'textAnchor',
  'font-size': 'fontSize'
}

function toReact(node: Element, key: number): ReactNode {
  const tag = node.tagName.toLowerCase()
  if (!SVG_TAGS.has(tag)) return null
  const props: Record<string, unknown> = { key }
  for (const attr of Array.from(node.attributes)) {
    const name = SVG_ATTRS[attr.name]
    if (name) props[name] = attr.value
  }
  const children = Array.from(node.childNodes).map((c, i) => (c.nodeType === Node.TEXT_NODE ? c.textContent : c.nodeType === Node.ELEMENT_NODE ? toReact(c as Element, i) : null))
  return createElement(tag, props, ...children)
}

export function Figure({ svg, large = false }: { svg: string; large?: boolean }) {
  const tree = useMemo(() => {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
    const root = doc.documentElement
    return root.tagName.toLowerCase() === 'svg' ? toReact(root, 0) : null
  }, [svg])
  if (!tree) return null
  return <div className={cn('wk-fig w-full border border-line/40 bg-black/50 p-1.5', !large && 'max-w-[240px]')}>{tree}</div>
}

export function Note({ note }: { note: WorkoutNote }) {
  return (
    <div className="border border-line/40 border-l-2 border-l-accent bg-accent/[0.04] px-3 py-2">
      <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-soft">{note.title}</div>
      <div className="mt-1 text-[13px] leading-relaxed text-white/85">{note.text}</div>
    </div>
  )
}

export function WorkoutState({ error, className }: { error: string | null; className?: string }) {
  if (error) return <AlertBox className={className}>{error}</AlertBox>
  return <div className={cn('font-mono text-[11px] text-dim', className)}>Loading…</div>
}

export function openEntry(kind: string, id: string): void {
  showInData({ kind, id })
}

export function ExerciseVisual({ ex, large = false }: { ex: Pick<WorkoutExercise, 'figures' | 'image' | 'video'>; large?: boolean }) {
  const asset = useData((s) => (ex.image ? s.assets.find((a) => a.id === ex.image) : undefined))
  if (!ex.figures.length && !asset && !ex.video) return null
  return (
    <div className={cn('flex shrink-0 flex-col gap-1.5', large ? 'w-[16em] max-w-[40%]' : 'w-[240px]')}>
      {asset && (asset.kind === 'video' ? <video src={assetUrl(asset)} controls className="w-full border border-line/40" /> : <img src={assetUrl(asset)} alt={asset.name} draggable={false} className="w-full border border-line/40 object-contain" />)}
      {ex.figures.map((f, i) => (
        <Figure key={i} svg={f} large={large} />
      ))}
      {ex.video && (
        <button onClick={() => showBrowser(ex.video, true)} className="flex items-center gap-1.5 border border-line/50 px-2 py-1 text-left text-[12px] text-accent hover:border-accent hover:text-white" title={ex.video}>
          <Video className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Watch the video</span>
        </button>
      )}
    </div>
  )
}

export function ExerciseGuide({ ex, large = false }: { ex: Pick<WorkoutExercise, 'how' | 'dos' | 'donts' | 'easier'>; large?: boolean }) {
  const tip = large ? 'border-l-4 px-[0.5em] py-[0.2em] text-[0.9em] leading-snug text-white' : 'border-l-2 px-2.5 py-1 text-[12.5px] text-white/85'
  const tag = large ? 'mr-[0.5em] font-mono text-[0.7em] font-bold uppercase tracking-wider' : 'mr-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider'
  return (
    <>
      {ex.how.length > 0 && (
        <ol className={cn('flex list-decimal flex-col marker:font-mono marker:text-accent-soft', large ? 'gap-[0.3em] pl-[1.6em] text-[1em] leading-snug text-white' : 'gap-1 pl-5 text-[13px] leading-relaxed text-white/85')}>
          {ex.how.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
      {(ex.dos.length > 0 || ex.donts.length > 0 || ex.easier) && (
        <div className={cn('flex flex-col', large ? 'gap-[0.3em]' : 'gap-1.5')}>
          {ex.dos.map((t, i) => (
            <div key={`do${i}`} className={cn(tip, 'border-l-ok bg-ok/5')}>
              <span className={cn(tag, 'text-ok')}>Do</span>
              {t}
            </div>
          ))}
          {ex.donts.map((t, i) => (
            <div key={`dont${i}`} className={cn(tip, 'border-l-alert bg-alert/5')}>
              <span className={cn(tag, 'text-alert')}>Don't</span>
              {t}
            </div>
          ))}
          {ex.easier && (
            <div className={cn(tip, 'border-l-teal bg-teal/5')}>
              <span className={cn(tag, 'text-teal')}>Easier</span>
              <Markdown text={ex.easier} />
            </div>
          )}
        </div>
      )}
    </>
  )
}

type Last = { date: string; values: number[] }

function ExerciseCard({ ex, index, last, sets, onSet }: { ex: WorkoutExercise; index: number; last?: Last; sets?: string[]; onSet?: (i: number, v: string) => void }) {
  return (
    <div className="flex flex-col gap-3 border border-line/50 bg-black/40 p-3">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[12px] text-faint">{String(index + 1).padStart(2, '0')}</span>
        <button onClick={() => openEntry('exercise', ex.id)} onContextMenu={(e) => entryMenuAt(e, 'exercise', ex.id, ex.name)} className="min-w-0 flex-1 truncate text-left text-[15px] font-semibold text-white hover:text-accent" title="Open this exercise">
          {showName(ex.name)}
        </button>
        <span className="shrink-0 border border-accent/50 bg-accent/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-accent">{doseText(ex, ex.unit)}</span>
      </div>
      <div className="flex flex-wrap gap-4">
        <ExerciseVisual ex={ex} />
        <div className="flex min-w-[220px] flex-1 flex-col gap-2.5">
          <ExerciseGuide ex={ex} />
          <div className="font-mono text-[11px] text-dim">{last ? <>Last ({last.date}): <span className="text-white">{valuesText(last.values)}</span></> : <span className="text-faint">Not logged yet</span>}</div>
          {onSet && (
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: ex.sets }, (_, i) => (
                <Input
                  key={i}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder={`Set ${i + 1}`}
                  value={sets?.[i] ?? ''}
                  onChange={(e) => onSet(i, e.target.value)}
                  className="h-8 w-20 font-mono text-[12.5px]"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function numbers(list: string[] | undefined): number[] {
  return (list ?? []).filter((v) => v !== undefined && v.trim() !== '').map(Number).filter((n) => Number.isFinite(n) && n >= 0)
}

function WorkoutFocus({ day, overview, date, start, values, onSet, onClose }: { day: WorkoutDay; overview: WorkoutOverview; date: string; start: number; values: (ex: WorkoutExercise) => string[] | undefined; onSet: (ex: WorkoutExercise, i: number, v: string) => void; onClose: () => void }) {
  const [at, setAt] = useState(Math.min(start, Math.max(0, day.exercises.length - 1)))
  const logged = useRef(new Map<string, string>())
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const box = useRef<HTMLDivElement>(null)
  const ex = day.exercises[at]

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => {
      let lo = 10
      let hi = 80
      while (hi - lo > 0.5) {
        const mid = (lo + hi) / 2
        el.style.fontSize = `${mid}px`
        if (el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1) lo = mid
        else hi = mid
      }
      el.style.fontSize = `${lo}px`
    }
    fit()
    const later = window.setTimeout(fit, 250)
    window.addEventListener('resize', fit)
    el.addEventListener('load', fit, true)
    return () => {
      window.clearTimeout(later)
      window.removeEventListener('resize', fit)
      el.removeEventListener('load', fit, true)
    }
  }, [at, ex?.id])

  const commit = (which: WorkoutExercise) => {
    const list = numbers(values(which))
    const key = list.join(',')
    if (!list.length || logged.current.get(which.id) === key) return
    logged.current.set(which.id, key)
    void engine('workout.setLog', { date, exercise: which.id, workout: day.id, values: list })
      .then(() => toast.success('Logged', `${showName(which.name)}: ${valuesText(list)}`))
      .catch((err) => {
        logged.current.delete(which.id)
        toast.error('Could not log it', errorText(err))
      })
  }
  const go = (to: number) => {
    if (ex) commit(ex)
    if (to < 0) return
    if (to >= day.exercises.length) return onClose()
    setAt(to)
  }
  const close = () => {
    if (ex) commit(ex)
    onClose()
  }

  useEffect(() => {
    inputs.current = []
    window.setTimeout(() => inputs.current[0]?.focus(), 0)
  }, [at])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      } else if (!typing && e.key === 'ArrowRight') go(at + 1)
      else if (!typing && e.key === 'ArrowLeft') go(at - 1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  if (!ex) return null
  const last = overview.last[ex.id]
  const sets = values(ex)
  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-black">
      <div className="flex shrink-0 items-center gap-6 border-b border-line/40 px-8 py-4">
        <span className="text-[clamp(20px,2vw,32px)] font-semibold text-white">{showName(day.label)}</span>
        <span className="font-mono text-[clamp(20px,2vw,32px)] text-accent-soft">
          {at + 1} / {day.exercises.length}
        </span>
        <span className="font-mono text-[clamp(16px,1.4vw,24px)] text-dim">{date}</span>
        <button title="Close (Esc)" onClick={close} className="ml-auto flex h-14 w-14 items-center justify-center text-dim hover:text-white">
          <X className="h-9 w-9" />
        </button>
      </div>
      <div ref={box} className="flex min-h-0 flex-1 gap-[1em] overflow-hidden px-10 py-8">
        <ExerciseVisual ex={ex} large />
        <div className="flex min-w-0 flex-1 flex-col gap-[0.5em]">
          <div className="text-[2.6em] font-bold leading-none text-white">{showName(ex.name)}</div>
          <div className="font-mono text-[2.1em] font-bold leading-none text-accent">{doseText(ex, ex.unit)}</div>
          <div className="font-mono text-[1.1em] text-dim">{last ? <>Last {last.date.slice(5)}: <span className="font-semibold text-white">{valuesText(last.values)}</span></> : 'Not logged yet'}</div>
          <div className="flex flex-wrap gap-[0.4em]">
            {Array.from({ length: ex.sets }, (_, i) => (
              <input
                key={`${ex.id}${i}`}
                ref={(el) => {
                  inputs.current[i] = el
                }}
                type="number"
                min={0}
                inputMode="numeric"
                placeholder={`${i + 1}`}
                value={sets?.[i] ?? ''}
                onChange={(e) => onSet(ex, i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  const next = inputs.current[i + 1]
                  if (next) next.focus()
                  else go(at + 1)
                }}
                className="h-[1.5em] w-[2.2em] appearance-none border-2 border-line/70 bg-black px-[0.1em] text-center font-mono text-[2.2em] font-bold text-white outline-none placeholder:text-white/15 focus:border-accent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            ))}
          </div>
          <ExerciseGuide ex={ex} large />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-6 border-t border-line/40 px-8 py-5">
        <button onClick={() => go(at - 1)} disabled={at === 0} className="flex h-20 items-center gap-3 border-2 border-line/70 px-8 text-[clamp(22px,2.2vw,34px)] font-semibold text-white hover:border-accent disabled:opacity-30">
          <ChevronLeft className="h-9 w-9" />
          Back
        </button>
        <div className="flex flex-1 justify-center gap-3">
          {day.exercises.map((e, i) => (
            <button key={`${e.id}${i}`} title={showName(e.name)} onClick={() => go(i)} className={cn('h-5 w-5 rounded-full', i === at ? 'bg-accent' : numbers(values(e)).length ? 'bg-ok' : 'bg-line')} />
          ))}
        </div>
        <button onClick={() => go(at + 1)} className="flex h-20 items-center gap-3 border-2 border-accent bg-accent/15 px-8 text-[clamp(22px,2.2vw,34px)] font-semibold text-white hover:bg-accent/25">
          {at + 1 === day.exercises.length ? 'Done' : 'Next'}
          <ChevronRight className="h-9 w-9" />
        </button>
      </div>
    </div>,
    document.body
  )
}

export function DayView({ overview, day }: { overview: WorkoutOverview; day: WorkoutDay }) {
  const [, redraw] = useState(0)
  const [date, setDate] = useState(dates.get(day.id) ?? overview.today)
  const [busy, setBusy] = useState(false)
  const [focus, setFocus] = useState<number | null>(null)
  const key = (ex: WorkoutExercise) => `${day.id}|${ex.id}`
  const setValue = (ex: WorkoutExercise, i: number, v: string) => {
    const list = [...(drafts.get(key(ex)) ?? [])]
    list[i] = v
    drafts.set(key(ex), list)
    redraw((n) => n + 1)
  }
  const save = async () => {
    const sets: Record<string, number[]> = {}
    for (const ex of day.exercises) {
      const vals = numbers(drafts.get(key(ex)))
      if (vals.length) sets[ex.id] = vals
    }
    if (!Object.keys(sets).length) return toast.error('Nothing to save', 'Fill in at least one set.')
    setBusy(true)
    try {
      await engine('workout.log', { workout: day.id, date, sets })
      for (const ex of day.exercises) drafts.delete(key(ex))
      dates.delete(day.id)
      toast.success('Session saved', `${showName(day.label)} · ${date}`)
    } catch (err) {
      toast.error('Could not save', errorText(err))
    }
    setBusy(false)
  }
  return (
    <div className="flex flex-col gap-3">
      {day.before.map((note, i) => <Note key={i} note={note} />)}
      {!day.exercises.length && <EmptyState title="No exercises yet">Open this workout to add exercises to it.</EmptyState>}
      {day.exercises.length > 0 && (
        <Button variant="secondary" icon={<Maximize2 />} onClick={() => setFocus(0)} className="self-start">
          Full screen
        </Button>
      )}
      {day.exercises.map((ex, i) => (
        <ExerciseCard key={`${ex.id}${i}`} ex={ex} index={i} last={overview.last[ex.id]} sets={drafts.get(key(ex))} onSet={(n, v) => setValue(ex, n, v)} />
      ))}
      {day.exercises.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border border-line/50 bg-black/60 p-2.5">
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-soft">Date</span>
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              dates.set(day.id, e.target.value)
            }}
            className="h-8 w-40 font-mono text-[12.5px]"
          />
          <Button variant="primary" icon={<Save />} disabled={busy} onClick={() => void save()} className="ml-auto">
            Save session
          </Button>
        </div>
      )}
      {day.after.map((note, i) => <Note key={i} note={note} />)}
      {focus !== null && <WorkoutFocus day={day} overview={overview} date={date} start={focus} values={(ex) => drafts.get(key(ex))} onSet={setValue} onClose={() => setFocus(null)} />}
    </div>
  )
}

function deleteSession(label: string, date: string, workout: string | null): void {
  confirmDelete(`Delete ${showName(label)} on ${date}?`, 'Its logged sets are removed.', () => engine('workout.deleteSession', { date, workout }))
}

export function HistoryView({ overview, limit, editable = true, workout = null }: { overview: WorkoutOverview; limit?: number; editable?: boolean; workout?: string | null }) {
  const all = workout ? overview.history.filter((h) => h.workout === workout) : overview.history
  const list = limit ? all.slice(0, limit) : all
  if (!list.length) return <EmptyState title="No sessions yet">Log a workout and it shows here.</EmptyState>
  return (
    <div className="flex flex-col gap-2">
      {list.map((h) => (
        <div
          key={`${h.date}|${h.workout ?? ''}`}
          onContextMenu={(e) =>
            openMenu(e, `${showName(h.label)} · ${h.date}`, [
              ...(h.workout ? [{ label: 'Open workout', icon: <FolderOpen />, onSelect: () => openEntry('workout', h.workout!) }] : []),
              ...(editable ? [{ label: 'Delete this session', icon: <Trash2 />, danger: true, onSelect: () => deleteSession(h.label, h.date, h.workout) }] : [])
            ])
          }
          className="group flex flex-col gap-1 border border-line/40 bg-black/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] text-white">{h.date}</span>
            {h.workout ? (
              <button onClick={() => openEntry('workout', h.workout!)} className="font-mono text-[11px] text-dim hover:text-accent">
                {showName(h.label)}
              </button>
            ) : (
              <span className="font-mono text-[11px] text-faint">{h.label}</span>
            )}
            {editable && (
              <button
                title="Delete this session"
                onClick={() => deleteSession(h.label, h.date, h.workout)}
                className="ml-auto text-dim opacity-0 hover:text-alert group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {h.rows.map((r) => (
            <div key={r.exercise} className="flex gap-2 text-[12.5px]">
              <span className="w-44 shrink-0 truncate text-white/80">{showName(r.name)}</span>
              <span className="font-mono text-accent">{valuesText(r.values)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function newWorkoutEntry(type: WorkoutPageType, label: string, data: unknown, then?: (id: string) => void): void {
  askText(`New ${label}`, 'Name', '', async (title) => {
    try {
      const meta = await engine('workout.save', { type, id: null, title, data })
      if (then) then(meta.id)
      else openEntry(type, meta.id)
    } catch (err) {
      toast.error(`Could not make the ${label}`, errorText(err))
    }
  })
}

export function WorkoutPanel({ compact = false }: { compact?: boolean }) {
  const { overview, error } = useWorkout()
  const [tab, setTab] = useState<string | null>(null)
  if (error || !overview) return <WorkoutState error={error} className="m-3" />
  const days = overview.workouts
  const pages = [...days.map((w) => w.id), HISTORY]
  const current = tab && pages.includes(tab) ? tab : (lastDone(overview)?.id ?? days[0]?.id ?? HISTORY)
  const day = days.find((w) => w.id === current)
  const body = (
    <div className="flex flex-col gap-3">
      <ShellTabs value={current} onChange={setTab} options={[...days.map((w) => ({ value: w.id, label: showName(w.label) })), { value: HISTORY, label: 'History' }]} />
      {day ? <DayView key={day.id} overview={overview} day={day} /> : <HistoryView overview={overview} />}
    </div>
  )
  if (compact) return <div className="min-h-0 flex-1 overflow-y-auto p-2.5">{body}</div>
  return (
    <Panel className="min-w-0 flex-1" title="Workout" meta={`${days.length} workout${days.length === 1 ? '' : 's'}`} bodyClassName="overflow-y-auto">
      {body}
    </Panel>
  )
}

export function openWorkout(): void {
  void engine('workout.overview')
    .then((o) => {
      const day = lastDone(o) ?? o.workouts[0]
      if (day) openEntry('workout', day.id)
      else useApp.getState().setView('data')
    })
    .catch(() => useApp.getState().setView('data'))
}

export function WorkoutResult({ data }: { data: unknown }) {
  const d = data as WorkoutViewData
  const { overview, error } = useWorkout()
  if (error || !overview) return <WorkoutState error={error} />
  const day = d.mode === 'workout' ? overview.workouts.find((w) => w.id === d.workout) : undefined
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-white">{day ? showName(day.label) : 'Workout history'}</span>
        <Button size="sm" variant="ghost" onClick={() => (day ? openEntry('workout', day.id) : openWorkout())} className="ml-auto">
          Open
        </Button>
      </div>
      {day ? day.exercises.map((ex, i) => <ExerciseCard key={`${ex.id}${i}`} ex={ex} index={i} last={overview.last[ex.id]} />) : <HistoryView overview={overview} limit={10} editable={false} workout={d.workout} />}
      {!day && d.mode === 'workout' && <EmptyState title="Workout not found">It may have been removed.</EmptyState>}
    </div>
  )
}

export function WorkoutGlance() {
  const { overview, error } = useWorkout()
  if (error || !overview) return <WorkoutState error={error} />
  const day = lastDone(overview)
  const lastSession = overview.history[0]
  if (!day) return <div className="text-[12.5px] text-dim">No workout done yet.</div>
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-soft">Last done</span>
        <span className="text-[14px] font-semibold text-white">{showName(day.label)}</span>
        {lastSession && <span className="ml-auto font-mono text-[10.5px] text-faint">last {lastSession.date}</span>}
      </div>
      <div className="flex flex-col">
        {day.exercises.map((ex, i) => (
          <div key={`${ex.id}${i}`} className="flex items-baseline gap-2 border-b border-line/20 py-1 text-[12.5px]">
            <span className="min-w-0 flex-1 truncate text-white/85">{showName(ex.name)}</span>
            <span className="shrink-0 font-mono text-[11px] text-accent">{doseText(ex, ex.unit)}</span>
            <span className="w-24 shrink-0 truncate text-right font-mono text-[11px] text-dim">{overview.last[ex.id] ? valuesText(overview.last[ex.id].values) : '—'}</span>
          </div>
        ))}
      </div>
      <Button size="sm" variant="ghost" onClick={() => openEntry('workout', day.id)} className="self-start">
        Open Workout
      </Button>
    </div>
  )
}

registerGlanceView('workout', { View: WorkoutGlance, entry: 'workout' })
