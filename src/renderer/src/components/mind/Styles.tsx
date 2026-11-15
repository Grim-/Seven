import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import type { ReasoningStyle, StyleVoice } from '@shared/types'
import { Button, EmptyState, Field, Input, Panel, Select, MakeOrSaved, useAutosavedState, ListRow, RowAction, confirmDelete } from '../ui'
import { engine } from '../../lib/ipc'
import { toast } from '../../store/toasts'
import { LinkTextarea } from '../data/LinkTextarea'
import { useStyleList } from '../../store/styles'
import { rowMenu } from '../../views/data/entryMenu'
import { useBusy } from '../../lib/useBusy'

export function useStyles(): ReasoningStyle[] {
  return useStyleList((s) => s.list)
}

export function StylePicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const list = useStyles()
  return (
    <Field label="Reasoning style" className="col-span-2" hint="Modus operandi and voice filter used in pre-output reasoning (reason tool and thinking). Styles live in Data under Reasoning styles.">
      <Select value={value ?? ''} options={[{ value: '', label: `Default (${list[0]?.name ?? 'plain'})` }, ...list.map((s) => ({ value: s.id, label: s.name }))]} onChange={(v) => onChange(v || null)} className="h-8 text-[12px]" />
    </Field>
  )
}

interface Draft {
  id: string | null
  name: string
  instruction: string
  voices: StyleVoice[]
  constraints: string
}

const BLANK: Draft = { id: null, name: '', instruction: '', voices: [], constraints: '' }

function Editor({ start, onSaved }: { start: Draft; onSaved: (id: string) => void }) {
  const clean = (d: Draft): Draft => ({ ...d, voices: d.voices.filter((v) => v.label.trim()) })
  const valid = (d: Draft) => Boolean(d.name.trim() && d.instruction.trim())
  const editor = useAutosavedState<Draft>(start, (d) => engine('styles.save', clean(d)), { when: (d) => Boolean(d.id) && valid(d) })
  const [busy, run] = useBusy()
  const draft = editor.value
  const setDraft = editor.set
  const setVoice = (i: number, patch: Partial<StyleVoice>) => setDraft({ ...draft, voices: draft.voices.map((v, j) => (j === i ? { ...v, ...patch } : v)) })
  const make = () =>
    void run(async () => {
      const saved = await engine('styles.save', clean(draft))
      toast.success('Style made', saved.name)
      onSaved(saved.id)
    }, 'Could not make the style')
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto">
      <Field label="Name">
        <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Green room" />
      </Field>
      <Field label="How it reasons" hint="One or two sentences. Kept short so reasoning stays quick.">
        <LinkTextarea rolls={false} rows={3} value={draft.instruction} onValue={(instruction) => setDraft({ ...draft, instruction })} placeholder="The voices argue briefly, then the Director settles it." />
      </Field>
      <Field label="Voices" hint="Optional. Each has a name and one line on who they are. They argue it out before the conclusion.">
        <div className="flex flex-col gap-1.5">
          {draft.voices.map((v, i) => (
            <div key={i} className="flex gap-2">
              <Input value={v.label} onChange={(e) => setVoice(i, { label: e.target.value })} placeholder="Name" className="w-40" />
              <Input value={v.line} onChange={(e) => setVoice(i, { line: e.target.value })} placeholder="Who they are, in one line" className="flex-1" />
              <Button size="sm" variant="ghost" icon={<X />} onClick={() => setDraft({ ...draft, voices: draft.voices.filter((_, j) => j !== i) })} />
            </div>
          ))}
          {draft.voices.length < 8 && (
            <div>
              <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => setDraft({ ...draft, voices: [...draft.voices, { label: '', line: '' }] })}>
                Add voice
              </Button>
            </div>
          )}
        </div>
      </Field>
      <Field label="Output & voice constraints" hint="Optional. Rules that forcefully filter what gets said or done through this character’s way of thinking and speaking before any text is output.">
        <LinkTextarea
          rolls={false}
          rows={3}
          value={draft.constraints}
          onValue={(constraints) => setDraft({ ...draft, constraints })}
          placeholder="e.g. Filter every line through clipped, cynical guard jargon. Refuse flowery apologies; say only what they would risk saying aloud."
        />
      </Field>
      <div className="flex items-center gap-2">
        <MakeOrSaved made={Boolean(draft.id)} saver={editor} what="style" onMake={make} disabled={busy || !valid(draft)} size="md" />
      </div>
    </div>
  )
}

export function StylesPanel({ initial }: { initial?: string | null }) {
  const list = useStyles()
  const [pick, setPick] = useState<string | null>(initial ?? null)
  const style = pick === '_new' ? null : (list.find((s) => s.id === pick) ?? list[0] ?? null)
  const editing = pick === '_new' ? BLANK : style ? { id: style.id, name: style.name, instruction: style.instruction, voices: style.voices, constraints: style.constraints ?? '' } : null
  const remove = (s: ReasoningStyle) =>
    confirmDelete(`Delete ${s.name}?`, 'Agents using it go back to the default style.', () => engine('styles.delete', { id: s.id }), () => setPick(null))
  return (
    <Panel
      className="flex-1"
      title="Reasoning styles"
      bodyClassName="flex min-h-0 gap-3 p-3"
      actions={
        <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => setPick('_new')}>
          New style
        </Button>
      }
    >
      <div className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-line/40 pr-2">
        {list.map((s) => (
          <ListRow
            key={s.id}
            active={s.id === style?.id && pick !== '_new'}
            onClick={() => setPick(s.id)}
            onMenu={rowMenu('style', s.id, s.name, () => setPick(s.id))}
            title={s.name}
            subtitle={s.voices.length ? `${s.voices.length} voices` : 'plain'}
            tone="tag"
            actions={<RowAction title="Delete" icon={<Trash2 />} danger onClick={() => remove(s)} />}
          />
        ))}
      </div>
      {editing ? <Editor key={editing.id ?? '_new'} start={editing} onSaved={setPick} /> : <EmptyState title="No styles">Make one with New style.</EmptyState>}
    </Panel>
  )
}
