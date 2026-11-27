import { useEffect, useState } from 'react'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import type { ExerciseData, Page, WorkoutData, WorkoutItem } from '@shared/types'
import { showName } from '@shared/ids'
import { unitText, valuesText } from '@shared/workout'
import { engine } from '../../lib/ipc'
import { usePage, useData } from '../../store/data'
import { Button, ChipInput, EntryHeader, EmptyState, Field, Input, ListEditor, SaveState, Textarea, useDraft, DoneEditing, useAutosavedState } from '../ui'
import { useWorkoutHistory } from './progress/useWorkoutHistory'
import { allMuscles } from './progress/stats'
import { PictureField } from '../pictures/PictureField'
import type { KindScreenProps } from '../../registries/kinds'
import { ExerciseProgressSection } from './progress/ExerciseProgressSection'
import { AddPicker, RowButtons, move, titleOf, usePagesOf } from './editParts'
import { DayView, ExerciseGuide, ExerciseVisual, HistoryView, newWorkoutEntry, openEntry, useWorkout } from './Workout'
import { entryMenuAt } from '../../views/data/entryMenu'
import { failed } from '../../lib/notify'
import { textLines } from '@shared/text'
import { MarkdownEditor } from '../data/MarkdownEditor'
import { NoteCards, filledNotes } from './NoteCards'


function Loading({ page }: { page: Page | null | undefined }) {
  if (page === undefined) return <div className="p-3 font-ui text-[11px] text-dim">Loading…</div>
  return <EmptyState title="Deleted">This entry no longer exists.</EmptyState>
}

function linesText(list: string[]): string {
  return list.join('\n')
}

type ExerciseDraft = { how: string; dos: string; donts: string; easier: string; video: string; figures: string[]; unit: string; muscles: string[] }

export function ExerciseScreen({ id }: KindScreenProps) {
  const page = usePage(id)
  const { history } = useWorkoutHistory()
  const muscleSuggestions = history ? allMuscles(history) : []
  const { overview } = useWorkout()
  const workouts = usePagesOf('workout')
  const full = useData((s) => s.full)
  const loadPage = useData((s) => s.loadPage)
  const [editing, setEditing] = useState(false)
  const editor = useAutosavedState<ExerciseDraft | null>(null, (d) => engine('workout.save', { type: 'exercise', id, title: null, data: { how: textLines(d!.how), dos: textLines(d!.dos), donts: textLines(d!.donts), easier: d!.easier, video: d!.video.trim() || null, figures: d!.figures.filter((f) => f.trim()), unit: d!.unit.trim(), muscles: d!.muscles } }), { when: (d) => d !== null })
  const draft = editor.value
  const setDraft = (next: ExerciseDraft) => editor.set(next)
  useEffect(() => {
    for (const w of workouts) if (!full[w.id]) void loadPage(w.id)
  }, [workouts.map((w) => w.id).join('|')])
  if (!page) return <Loading page={page} />
  const data = (page.data ?? {}) as Partial<ExerciseData>
  const ex = { how: data.how ?? [], dos: data.dos ?? [], donts: data.donts ?? [], easier: data.easier ?? '', figures: data.figures ?? [], video: data.video ?? null, image: page.image ?? null, unit: data.unit ?? '', muscles: data.muscles ?? [] }
  const usedIn = workouts.filter((w) => (((full[w.id]?.data ?? {}) as Partial<WorkoutData>).items ?? []).some((i) => i.exercise === page.id))
  const last = overview?.last[page.id]
  const begin = () => {
    editor.reset({ how: linesText(ex.how), dos: linesText(ex.dos), donts: linesText(ex.donts), easier: ex.easier, video: ex.video ?? '', figures: [...ex.figures], unit: ex.unit, muscles: ex.muscles })
    setEditing(true)
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <EntryHeader title={showName(page.title)} kind={`Exercise · ${unitText(ex)}`} onMenu={(e) => entryMenuAt(e, 'exercise', page.id, page.title)}>
        {editing ? (
          <DoneEditing saver={editor} onDone={() => setEditing(false)} />
        ) : (
          <>
            <SaveState status={editor.status} error={editor.error} />
            <Button size="sm" variant="ghost" icon={<Pencil />} onClick={begin}>
              Edit
            </Button>
          </>
        )}
      </EntryHeader>
      {editing && draft ? (
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          <Field label="How to do it" hint="In order. Drag to reorder." className="col-span-2">
            <ListEditor values={textLines(draft.how)} onChange={(l) => setDraft({ ...draft, how: linesText(l) })} placeholder="Add a step" />
          </Field>
          <Field label="Do" hint="Good form and what to watch for.">
            <ListEditor values={textLines(draft.dos)} onChange={(l) => setDraft({ ...draft, dos: linesText(l) })} placeholder="Add one" />
          </Field>
          <Field label="Don't" hint="Bad form and what to avoid.">
            <ListEditor values={textLines(draft.donts)} onChange={(l) => setDraft({ ...draft, donts: linesText(l) })} placeholder="Add one" />
          </Field>
          <Field label="Easier version" hint="A less strenuous version, if there is one. @exercise:Name links another exercise." className="col-span-2">
            <MarkdownEditor compact value={draft.easier} onValue={(easier) => setDraft({ ...draft, easier })} />
          </Field>
          <Field label="Counted in" hint="What one number means, written however you like, e.g. reps, seconds, reps per arm.">
            <Input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="reps" />
          </Field>
          <Field label="Works" hint="The muscles it works, in your own words. The Stats tab adds up sets per muscle from these.">
            <ChipInput value={draft.muscles} onChange={(muscles) => setDraft({ ...draft, muscles })} suggestions={muscleSuggestions} placeholder="Add a muscle, e.g. chest" />
          </Field>
          <Field label="Video" hint="A link to a video of it, e.g. on YouTube. Opens in Seven's browser.">
            <Input value={draft.video} onChange={(e) => setDraft({ ...draft, video: e.target.value })} placeholder="https://" />
          </Field>
          <Field label="Picture" hint="A picture, GIF or video from your files.">
            <PictureField value={ex.image} onChange={(image) => void engine('data.pages.image', { id: page.id, image }).catch(failed('Could not set the picture'))} />
          </Field>
          <Field label="Drawings" hint="Stick-figure SVG drawings, one per box." className="col-span-2">
            <div className="flex flex-col gap-2">
              {draft.figures.map((f, i) => (
                <div key={i} className="flex gap-2">
                  <Textarea mono rows={3} value={f} onChange={(e) => setDraft({ ...draft, figures: draft.figures.map((x, j) => (j === i ? e.target.value : x)) })} className="flex-1" />
                  <button title="Remove this drawing" onClick={() => setDraft({ ...draft, figures: draft.figures.filter((_, j) => j !== i) })} className="self-start p-1 text-dim hover:text-alert">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => setDraft({ ...draft, figures: [...draft.figures, '<svg viewBox="0 0 200 110"></svg>'] })} className="self-start">
                Add a drawing
              </Button>
            </div>
          </Field>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          <ExerciseVisual ex={ex} />
          <div className="flex min-w-[240px] flex-1 flex-col gap-2.5">
            <ExerciseGuide ex={ex} />
            {!ex.how.length && !ex.dos.length && !ex.donts.length && !ex.easier && <div className="text-[12.5px] text-faint">Nothing written yet. Edit it, or ask an agent to fill it in.</div>}
            <div className="font-ui text-[11px] text-dim">{last ? <>Last ({last.date}): <span className="text-ink">{valuesText(last.values)}</span></> : <span className="text-faint">Not logged yet</span>}</div>
            {usedIn.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-dim">
                In
                {usedIn.map((w) => (
                  <button key={w.id} onClick={() => openEntry('workout', w.id)} onContextMenu={(e) => entryMenuAt(e, 'workout', w.id, w.title)} className="border border-line/50 px-1.5 py-0.5 text-ink/85 hover:border-accent">
                    {w.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {!editing && <ExerciseProgressSection id={page.id} unit={ex.unit} />}
    </div>
  )
}

function NumberBox({ value, title, onValue }: { value: number; title: string; onValue: (n: number) => void }) {
  const [text, setText] = useState(String(value))
  useEffect(() => {
    if (Number(text) !== value) setText(String(value))
  }, [value])
  return (
    <Input
      type="number"
      min={0}
      value={text}
      title={title}
      onChange={(e) => {
        setText(e.target.value)
        const n = Math.round(Number(e.target.value))
        if (e.target.value.trim() && Number.isFinite(n) && n >= 0) onValue(n)
      }}
      className="h-7 w-16 font-ui text-[12px]"
    />
  )
}

export function WorkoutEntryScreen({ id }: KindScreenProps) {
  const page = usePage(id)
  const { overview } = useWorkout()
  const exercises = usePagesOf('exercise')
  const [editing, setEditing] = useState(false)
  const stored = (page?.data ?? {}) as Partial<WorkoutData>
  const saved: WorkoutData = { items: stored.items ?? [], before: stored.before ?? [], after: stored.after ?? [] }
  const { draft, change: putData, status, error } = useDraft<WorkoutData>(saved, (next) => engine('workout.save', { type: 'workout', id, title: null, data: { items: next.items, before: filledNotes(next.before), after: filledNotes(next.after) } }))
  if (!page) return <Loading page={page} />
  const items = draft.items
  const put = (next: WorkoutItem[] | ((list: WorkoutItem[]) => WorkoutItem[])) => putData((d) => ({ ...d, items: typeof next === 'function' ? next(d.items) : next }))
  const change = (i: number, patch: Partial<WorkoutItem>) => put((list) => list.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const day = overview?.workouts.find((w) => w.id === page.id) ?? null
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <EntryHeader title={showName(page.title)} kind="Workout" onMenu={(e) => entryMenuAt(e, 'workout', page.id, page.title)}>
        <SaveState status={status} error={error} />
        <Button size="sm" variant={editing ? 'primary' : 'ghost'} icon={editing ? <Check /> : <Pencil />} onClick={() => setEditing(!editing)}>
          {editing ? 'Done' : 'Edit'}
        </Button>
      </EntryHeader>
      {editing ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 font-label text-[10.5px] caps-12 text-faint">
            <span className="flex-1">Exercise</span>
            <span className="w-16">Sets</span>
            <span className="w-16">Min</span>
            <span className="w-16">Max</span>
            <span className="w-[84px]" />
          </div>
          {items.map((item, i) => (
            <div key={`${item.exercise}${i}`} className="flex items-center gap-2 border-b border-line/20 py-1">
              <button onClick={() => openEntry('exercise', item.exercise)} onContextMenu={(e) => entryMenuAt(e, 'exercise', item.exercise, titleOf(exercises, item.exercise), [{ label: 'Remove from this workout', onSelect: () => put(items.filter((_, j) => j !== i)) }])} className="min-w-0 flex-1 truncate text-left text-[13.5px] text-ink hover:text-accent">
                {titleOf(exercises, item.exercise)}
              </button>
              <NumberBox value={item.sets} title="Sets" onValue={(sets) => change(i, { sets })} />
              <NumberBox value={item.min} title="Lowest target per set" onValue={(min) => change(i, { min })} />
              <NumberBox value={item.max} title="Highest target per set" onValue={(max) => change(i, { max })} />
              <RowButtons onUp={() => put(move(items, i, -1))} onDown={() => put(move(items, i, 1))} onRemove={() => put(items.filter((_, j) => j !== i))} />
            </div>
          ))}
          {!items.length && <div className="py-2 text-[12.5px] text-faint">No exercises yet.</div>}
          <AddPicker label="Add an exercise…" options={exercises} onPick={(e) => put([...items, { exercise: e, sets: 3, min: 8, max: 12 }])} onNew={() => newWorkoutEntry('exercise', 'exercise', {}, (e) => put([...items, { exercise: e, sets: 3, min: 8, max: 12 }]))} />
          <div className="text-[12px] text-faint">Min and max are the target per set, in whatever each exercise is counted in.</div>
          <NoteCards label="Before (warm-up)" hint="Shown above the workout." values={draft.before} onChange={(before) => putData((d) => ({ ...d, before }))} />
          <NoteCards label="After (cool-down)" hint="Shown below the workout." values={draft.after} onChange={(after) => putData((d) => ({ ...d, after }))} />
        </div>
      ) : overview && day ? (
        <DayView key={day.id} overview={overview} day={day} />
      ) : null}
      {overview && (
        <div className="flex flex-col gap-2">
          <span className="font-label text-[10.5px] font-semibold caps-14 text-accent-soft">History</span>
          <HistoryView overview={overview} workout={page.id} />
        </div>
      )}
    </div>
  )
}
