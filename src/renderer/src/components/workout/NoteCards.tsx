import type { WorkoutNote } from '@shared/types'
import { Field, Input, TextCards } from '../ui'
import { MarkdownEditor } from '../data/MarkdownEditor'

export const filledNotes = (notes: WorkoutNote[]) => notes.filter((n) => n.title.trim() || n.text.trim())

export function NoteCards({ label, hint, values, onChange }: { label: string; hint: string; values: WorkoutNote[]; onChange: (next: WorkoutNote[]) => void }) {
  return (
    <Field label={label} hint={hint}>
      <TextCards<WorkoutNote>
        values={values}
        onChange={onChange}
        blank={{ title: '', text: '' }}
        addLabel="Add a note"
        editor={(n, set) => (
          <div className="flex flex-col gap-1">
            <Input value={n.title} placeholder="Title" onChange={(e) => set({ ...n, title: e.target.value })} className="h-7 text-[12.5px]" />
            <MarkdownEditor compact value={n.text} onValue={(text) => set({ ...n, text })} />
          </div>
        )}
      />
    </Field>
  )
}
