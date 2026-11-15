import { useState, type MouseEvent } from 'react'
import { ArrowDownToLine, EyeOff, Plus, Trash2 } from 'lucide-react'
import { showName } from '@shared/ids'
import { FIELD_TYPES, FIELD_TYPE_LABELS, PLACE_LABELS, readLayout, type CardField, type CardLayout, type CardValue, type FieldType, type Place } from '@shared/cards'
import { Button, ChipInput, ColorRow, Eyebrow, Field, Input, Select, openMenu, type FaceSlot, type MenuItem } from '../ui'
import type { KindScreenProps } from '../../registries/kinds'
import { useModulePageState } from '../../lib/modulePage'
import { AddonPage, AddonTitle } from '../data/AddonPage'
import { CardFace, inSlot, placeFor } from './CardFace'
import { newFieldId } from './model'

const whereIs = (f: CardField) => PLACE_LABELS[f.place]

function sample(f: CardField): CardValue {
  if (f.type === 'number') return 0
  if (f.type === 'picture') return null
  if (f.type === 'choice') return f.options[0] ?? f.label
  if (f.type === 'list') return [f.label]
  return f.label
}

function FieldRow({ field, onChange, onHide, onDelete }: { field: CardField; onChange: (f: CardField) => void; onHide?: () => void; onDelete: () => void }) {
  const set = (patch: Partial<CardField>) => onChange({ ...field, ...patch })
  return (
    <div className="flex flex-col gap-1.5 border-t border-line/30 pt-2 first:border-t-0 first:pt-0">
      <div className="grid grid-cols-[minmax(0,1fr)_9rem_auto_auto] items-center gap-2">
        <Input value={field.label} onChange={(e) => set({ label: e.target.value })} placeholder="Label" />
        <Select value={field.type} options={FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABELS[t] }))} onChange={(v) => set({ type: v as FieldType })} />
        {onHide ? <Button size="sm" variant="ghost" icon={<EyeOff />} title="Take off the card" onClick={onHide} /> : <span />}
        <Button size="sm" variant="ghost" icon={<Trash2 />} title="Delete field" onClick={onDelete} />
      </div>
      {field.type === 'choice' && <ChipInput value={field.options} onChange={(options) => set({ options })} placeholder="Add a choice" />}
    </div>
  )
}

function Editor({ pageId, title, start }: { pageId: string; title: string; start: CardLayout }) {
  const saver = useModulePageState<CardLayout>(pageId, start)
  const layout = saver.value
  const [picked, setPicked] = useState<FaceSlot | null>(null)
  const setFields = (fields: CardField[]) => saver.set((l) => ({ ...l, fields }))
  const update = (next: CardField) => setFields(layout.fields.map((f) => (f.id === next.id ? next : f)))
  const place = (id: string, to: Place) => setFields(layout.fields.map((f) => (f.id === id ? { ...f, place: to } : f)))
  const remove = (id: string) => setFields(layout.fields.filter((f) => f.id !== id))
  const add = (slot: FaceSlot) => setFields([...layout.fields, { id: newFieldId(), label: 'New field', type: slot === 'art' ? 'picture' : 'text', place: placeFor(slot), options: [] }])
  const samples = Object.fromEntries(layout.fields.map((f) => [f.id, sample(f)]))
  const here = picked ? layout.fields.filter((f) => inSlot(f, picked)) : []
  const elsewhere = picked ? layout.fields.filter((f) => !inSlot(f, picked)) : []
  const hidden = layout.fields.filter((f) => f.place === 'none')

  const slotItems = (slot: FaceSlot): MenuItem[] => {
    const others = layout.fields.filter((f) => !inSlot(f, slot))
    return [
      { label: 'Add a field here', icon: <Plus />, onSelect: () => add(slot) },
      ...(others.length ? [{ label: 'Move a field here', icon: <ArrowDownToLine />, children: others.map((f) => ({ label: `${f.label} (${whereIs(f)})`, onSelect: () => place(f.id, placeFor(slot)) })) }] : [])
    ]
  }
  const onSlot = (slot: FaceSlot, e: MouseEvent<HTMLElement>) => {
    setPicked(slot)
    if (e.type === 'contextmenu') openMenu(e, PLACE_LABELS[placeFor(slot)], slotItems(slot))
  }

  return (
    <div className="flex flex-col gap-4">
      <AddonTitle pageId={pageId} title={title} status={saver.status} error={saver.error} onRenamed={(name) => saver.set((l) => ({ ...l, name }))} />
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex flex-col items-center gap-2">
          <CardFace name={showName(title)} layout={layout} values={samples} edit={{ picked, hint: (slot) => PLACE_LABELS[placeFor(slot)], onSlot }} className="w-80" />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">Click a part of the card to fill it</span>
        </div>
        <div className="flex min-w-[22rem] flex-1 flex-col gap-4">
          <Field label="Colour" group>
            <ColorRow value={layout.color} onChange={(color) => color && saver.set((l) => ({ ...l, color }))} />
          </Field>
          {picked ? (
            <Field label={PLACE_LABELS[placeFor(picked)]} group>
              <div className="flex flex-col gap-2">
                {here.length === 0 && <span className="text-[12px] text-dim">Nothing here yet.</span>}
                {here.map((f) => (
                  <FieldRow key={f.id} field={f} onChange={update} onHide={() => place(f.id, 'none')} onDelete={() => remove(f.id)} />
                ))}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button size="sm" variant="secondary" icon={<Plus />} onClick={() => add(picked)}>
                    Add a field here
                  </Button>
                  {elsewhere.length > 0 && <Select value="" options={[{ value: '', label: 'Move a field here…' }, ...elsewhere.map((f) => ({ value: f.id, label: `${f.label} (${whereIs(f)})` }))]} onChange={(id) => id && place(id, placeFor(picked))} className="h-8 w-56 text-[12px]" />}
                </div>
              </div>
            </Field>
          ) : (
            <Eyebrow>Pick a part of the card to see and change what fills it.</Eyebrow>
          )}
          {hidden.length > 0 && (
            <Field label="Not on the card" hint="Cards still hold these values, and agents read them." group>
              <div className="flex flex-col gap-2">
                {hidden.map((f) => (
                  <FieldRow key={f.id} field={f} onChange={update} onDelete={() => remove(f.id)} />
                ))}
              </div>
            </Field>
          )}
        </div>
      </div>
    </div>
  )
}

export function LayoutScreen({ id }: KindScreenProps) {
  return <AddonPage id={id} what="card layout" read={readLayout} render={(page) => <Editor {...page} />} />
}
