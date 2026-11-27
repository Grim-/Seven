import { useContext, useMemo, useState } from 'react'
import { showName } from '@shared/ids'
import { PLACE_LABELS, readValues, type CardField, type CardValue } from '@shared/cards'
import { AlertBox, ColorRow, Field, SaveState, Select, Toggle, VariationTabs, type FaceSlot } from '../ui'
import { useModuleList } from '../../registries/useModuleList'
import type { KindScreenProps } from '../../registries/kinds'
import { useModulePageState } from '../../lib/modulePage'
import { cardImageContext, useRegisterImageContext } from '../../lib/imagePromptContext'
import { InsideSlateContext } from '../entries/EntryCard'
import { AddonPage, AddonTitle } from '../data/AddonPage'
import { inSlot, placeFor } from './CardFace'
import { CardOf } from './LiveCard'
import { ValueField } from './ValueFields'
import { LinkTextarea } from '../data/LinkTextarea'
import { LAYOUT_TYPE, playText, readCard, useLayoutNamed, useTypePages } from './model'
import { cardVariations } from './variations'

function UseFields({ entry, change }: { entry: Record<string, unknown>; change: (next: Record<string, unknown>) => void }) {
  const card = readCard(entry, '')
  const variations = useModuleList(cardVariations) ?? []
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <VariationTabs
        entry={entry}
        change={change}
        variations={variations}
        ownLabel="Prompt"
        own={
          <div className="flex flex-col gap-3">
            <Field label="What happens" hint="On the card under its flavour text, and told to the agent. Repo rolls in it roll when played.">
              <LinkTextarea value={card.happens || card.prompt} rows={4} placeholder="A portal opens and a hulking mercenary steps out, demanding payment." onValue={(happens) => change({ ...entry, happens, prompt: '' })} />
            </Field>
            <Field label="Agent instructions" hint="Only for the agent: how to play it out.">
              <LinkTextarea value={card.instructions} rows={4} placeholder="If the player pays, the mercenary fights for them this scene. If they refuse or attack, it turns hostile." onValue={(instructions) => change({ ...entry, instructions })} />
            </Field>
            <Toggle checked={card.hideInstructions} onChange={(hideInstructions) => change({ ...entry, hideInstructions })} label="Hide the agent instructions from the player in the chat" />
          </div>
        }
      />
      <Toggle checked={card.ask} onChange={(ask) => change({ ...entry, ask })} label="Ask the player what they do when it's played" />
      {card.ask && (
        <Field label="Hint for the player">
          <LinkTextarea value={card.askHint} rows={2} placeholder={playText(card)} onValue={(askHint) => change({ ...entry, askHint })} />
        </Field>
      )}
    </div>
  )
}

function Values({ label, hint, fields, values, onChange }: { label: string; hint?: string; fields: CardField[]; values: Record<string, CardValue>; onChange: (field: string, value: CardValue) => void }) {
  return (
    <Field label={label} hint={hint} group>
      <div className="flex flex-col gap-3">
        {fields.map((f) => (
          <ValueField key={f.id} field={f} value={values[f.id] ?? null} onChange={(v) => onChange(f.id, v)} />
        ))}
      </div>
    </Field>
  )
}

function Editor({ pageId, title, start }: { pageId: string; title: string; start: Record<string, unknown> }) {
  const insideSlate = useContext(InsideSlateContext)
  const saver = useModulePageState<Record<string, unknown>>(pageId, start)
  const card = readCard(saver.value, title)
  const layouts = useTypePages(LAYOUT_TYPE)
  const layout = useLayoutNamed(card.layout)
  const [picked, setPicked] = useState<FaceSlot | null>(null)
  const set = (patch: Record<string, unknown>) => saver.set((c) => ({ ...c, ...patch }))
  const setValue = (field: string, value: CardValue) => saver.set((c) => ({ ...c, values: { ...readValues(c.values), [field]: value } }))
  const artField = layout?.fields.find((f) => f.place === 'art' && f.type === 'picture') ?? null
  const artValue = artField ? (typeof card.values[artField.id] === 'string' ? (card.values[artField.id] as string) : '') : ''
  const rawArt = typeof card.raw.art === 'string' ? card.raw.art : ''
  const hasAnyArt = Boolean(artValue || rawArt)
  const clearCardArt = () => {
    if (artField && artValue) setValue(artField.id, '')
    if (rawArt) set({ art: null })
  }
  const here = layout && picked ? layout.fields.filter((f) => inSlot(f, picked)) : []
  const offCard = layout ? layout.fields.filter((f) => f.place === 'none') : []
  const edit = layout ? { picked, hint: (slot: FaceSlot) => PLACE_LABELS[placeFor(slot)], onSlot: (slot: FaceSlot) => setPicked(slot) } : undefined
  const cardContext = useMemo(() => {
    const formatValue = (v: CardValue): string =>
      Array.isArray(v) ? v.filter(Boolean).join(', ') : typeof v === 'string' || typeof v === 'number' ? String(v).trim() : ''
    const fields: { label: string; text: string }[] = []
    if (layout) {
      for (const f of layout.fields) {
        if (f.type === 'picture') continue
        const text = formatValue(card.values[f.id] ?? null)
        if (text) fields.push({ label: f.label || f.id, text })
      }
    } else {
      for (const [k, v] of Object.entries(card.values)) {
        const text = formatValue(v)
        if (text) fields.push({ label: k, text })
      }
    }
    if (card.happens || card.prompt) fields.push({ label: 'What happens', text: card.happens || card.prompt })
    if (card.instructions) fields.push({ label: 'Instructions', text: card.instructions })
    return cardImageContext(showName(title) || 'Card', fields)
  }, [title, layout, card.values, card.happens, card.prompt, card.instructions])
  useRegisterImageContext(cardContext)
  return (
    <div className="flex flex-col gap-3">
      {!insideSlate ? (
        <AddonTitle pageId={pageId} title={title} status={saver.status} error={saver.error} onRenamed={(name) => set({ name })} />
      ) : (
        saver.status !== 'idle' && (
          <div className="flex justify-end">
            <SaveState status={saver.status} error={saver.error} />
          </div>
        )
      )}
      <div className="flex flex-wrap items-start gap-5">
        <div className={insideSlate ? 'flex w-64 shrink-0 flex-col gap-2.5' : 'flex w-80 shrink-0 flex-col gap-3 phone:w-full'}>
          <Select value={card.layout ?? ''} options={[{ value: '', label: 'No layout' }, ...layouts.map((p) => ({ value: p.title, label: showName(p.title) }))]} onChange={(v) => set({ layout: v || null })} className="h-8 text-[12.5px]" />
          <ColorRow value={card.color} onChange={(color) => set({ color })} allowNone />
          <CardOf card={card} layout={layout} edit={edit} className="w-full" />
          {hasAnyArt && (
            <button
              type="button"
              onClick={clearCardArt}
              className="self-start font-label text-[10.5px] caps-5 text-dim hover:text-alert cursor-pointer"
            >
              × Clear card art
            </button>
          )}
          {!layout && (card.layout ? <AlertBox>There is no card layout called {showName(card.layout)} any more. Pick another layout.</AlertBox> : <div className="text-[12.5px] text-dim">{layouts.length ? 'Pick a layout to fill in this card.' : 'Make a card layout first (New page → Card layout), then pick it here.'}</div>)}
          {layout && !picked && <span className="font-label text-[10px] caps-12 text-faint">Click a part of the card to fill it</span>}
          {layout && picked && (here.length ? <Values label={PLACE_LABELS[placeFor(picked)]} hint={picked === 'body' ? 'Flavour text. The prompt is added under it on the card.' : undefined} fields={here} values={card.values} onChange={setValue} /> : <span className="text-[12.5px] text-dim">This layout puts nothing here. Add a field here on the layout.</span>)}
          {offCard.length > 0 && <Values label="Not on the card" hint="Cards still hold these values, and agents read them." fields={offCard} values={card.values} onChange={setValue} />}
        </div>
        <div className="min-w-[16rem] flex-1">
          <UseFields entry={saver.value} change={(next) => saver.set(() => next)} />
        </div>
      </div>
    </div>
  )
}

export function CardScreen({ id }: KindScreenProps) {
  return <AddonPage id={id} what="card" read={(data, title) => readCard(data, title).raw} render={(page) => <Editor {...page} />} />
}
