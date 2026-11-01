import { showName } from '@shared/ids'
import { FIELD_TYPES, FIELD_TYPE_LABELS, FRAMES, FRAME_LABELS, PLACES, PLACE_LABELS, readLayout, type CardField, type CardLayout, type CardValue, type FieldType, type Frame, type Place } from '@shared/cards'
import { ChipInput, ColorRow, Eyebrow, Field, Input, Select, TextCards } from '../ui'
import type { KindScreenProps } from '../../registries/kinds'
import { useModulePageState } from '../../lib/modulePage'
import { AddonPage, AddonTitle } from '../data/AddonPage'
import { CardFace } from './CardFace'
import { newFieldId } from './model'

const BLANK: CardField = { id: '', label: 'New field', type: 'text', place: 'body', options: [] }

function sample(f: CardField): CardValue {
  if (f.type === 'number') return 0
  if (f.type === 'picture') return null
  if (f.type === 'choice') return f.options[0] ?? f.label
  if (f.type === 'list') return [f.label]
  return f.label
}

function FieldRow({ field, onChange }: { field: CardField; onChange: (f: CardField) => void }) {
  const set = (patch: Partial<CardField>) => onChange({ ...field, ...patch })
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[minmax(0,1fr)_9rem_10rem] gap-2">
        <Input value={field.label} onChange={(e) => set({ label: e.target.value })} placeholder="Label" />
        <Select value={field.type} options={FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABELS[t] }))} onChange={(v) => set({ type: v as FieldType })} />
        <Select value={field.place} options={PLACES.map((p) => ({ value: p, label: PLACE_LABELS[p] }))} onChange={(v) => set({ place: v as Place })} />
      </div>
      {field.type === 'choice' && <ChipInput value={field.options} onChange={(options) => set({ options })} placeholder="Add a choice" />}
    </div>
  )
}

function Editor({ pageId, title, start }: { pageId: string; title: string; start: CardLayout }) {
  const saver = useModulePageState<CardLayout>(pageId, start)
  const layout = saver.value
  const change = (patch: Partial<CardLayout>) => saver.set((l) => ({ ...l, ...patch }))
  const samples = Object.fromEntries(layout.fields.map((f) => [f.id, sample(f)]))
  return (
    <div className="flex flex-col gap-4">
      <AddonTitle pageId={pageId} title={title} status={saver.status} error={saver.error} onRenamed={(name) => change({ name })} />
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-[22rem] flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Frame" className="min-w-[11rem]">
              <Select value={layout.frame} options={FRAMES.map((f) => ({ value: f, label: FRAME_LABELS[f] }))} onChange={(v) => change({ frame: v as Frame })} />
            </Field>
            <Field label="Colour" group>
              <ColorRow value={layout.color} onChange={(color) => color && change({ color })} />
            </Field>
          </div>
          <Field label="Fields" group>
            <TextCards<CardField>
              values={layout.fields}
              blank={BLANK}
              onChange={(fields) => change({ fields: fields.map((f) => (f.id ? f : { ...f, id: newFieldId() })) })}
              addLabel="Add a field"
              empty="No fields yet."
              editor={(field, set) => <FieldRow field={field} onChange={set} />}
            />
          </Field>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Eyebrow>Preview</Eyebrow>
          <CardFace name={showName(title)} layout={layout} values={samples} className="w-64" />
        </div>
      </div>
    </div>
  )
}

export function LayoutScreen({ id }: KindScreenProps) {
  return <AddonPage id={id} what="card layout" read={readLayout} render={(page) => <Editor {...page} />} />
}
