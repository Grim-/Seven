import { showName } from '@shared/ids'
import { readValues, type CardValue } from '@shared/cards'
import { CARD_USES } from '@shared/cardDecks'
import { AlertBox, ColorRow, Eyebrow, Field, Segmented, Select, Textarea } from '../ui'
import { ActionForm, BLANK_ACTION } from '../play/ActionForm'
import { BLANK_DECISION, DecisionForm } from '../play/DecisionForm'
import type { KindScreenProps } from '../../registries/kinds'
import { useModulePageState } from '../../lib/modulePage'
import { AddonPage, AddonTitle } from '../data/AddonPage'
import { CardOf } from './LiveCard'
import { ValueFields } from './ValueFields'
import { LAYOUT_TYPE, readCard, useLayoutNamed, useTypePages, type Card } from './model'

const TRY = { link: null, agents: [] }

function UseFields({ card, set }: { card: Card; set: (patch: Record<string, unknown>) => void }) {
  return (
    <div className="flex flex-col gap-2.5 border border-line/40 p-3">
      <div className="flex items-center gap-3">
        <Eyebrow>Use</Eyebrow>
        <Segmented value={card.use} options={CARD_USES} onChange={(use) => set({ use })} />
      </div>
      {card.use === 'generic' && (
        <Field label="Prompt" hint="Sent as your message when it's played. Repo rolls in it roll then.">
          <Textarea value={card.prompt} rows={4} onChange={(e) => set({ prompt: e.target.value })} />
        </Field>
      )}
      {card.use === 'action' && <ActionForm initial={card.action ?? BLANK_ACTION} character={null} where={TRY} onChange={(action) => set({ action })} keepLabel="" />}
      {card.use === 'decision' && <DecisionForm initial={card.decision ?? BLANK_DECISION} where={TRY} onChange={(decision) => set({ decision })} keepLabel="" />}
    </div>
  )
}

function Editor({ pageId, title, start }: { pageId: string; title: string; start: Record<string, unknown> }) {
  const saver = useModulePageState<Record<string, unknown>>(pageId, start)
  const card = readCard(saver.value, title)
  const layouts = useTypePages(LAYOUT_TYPE)
  const layout = useLayoutNamed(card.layout)
  const set = (patch: Record<string, unknown>) => saver.set((c) => ({ ...c, ...patch }))
  const setValue = (field: string, value: CardValue) => saver.set((c) => ({ ...c, values: { ...readValues(c.values), [field]: value } }))
  return (
    <div className="flex flex-col gap-4">
      <AddonTitle pageId={pageId} title={title} status={saver.status} error={saver.error} onRenamed={(name) => set({ name })} />
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-[18rem] flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Layout" className="min-w-[12rem]">
              <Select value={card.layout ?? ''} options={[{ value: '', label: 'No layout' }, ...layouts.map((p) => ({ value: p.title, label: showName(p.title) }))]} onChange={(v) => set({ layout: v || null })} />
            </Field>
            <Field label="Colour" group>
              <ColorRow value={card.color} onChange={(color) => set({ color })} allowNone />
            </Field>
          </div>
          <UseFields card={card} set={set} />
          {layout ? (
            <ValueFields layout={layout} values={card.values} onChange={setValue} />
          ) : card.layout ? (
            <AlertBox>There is no card layout called {showName(card.layout)} any more. Pick another layout.</AlertBox>
          ) : (
            <div className="text-[12.5px] text-dim">{layouts.length ? 'Pick a layout to fill in this card.' : 'Make a card layout first (New page → Card layout), then pick it here.'}</div>
          )}
        </div>
        <div className="flex flex-col items-center gap-2">
          <Eyebrow>Preview</Eyebrow>
          <CardOf card={card} layout={layout} className="w-64" />
        </div>
      </div>
    </div>
  )
}

export function CardScreen({ id }: KindScreenProps) {
  return <AddonPage id={id} what="card" read={(data, title) => readCard(data, title).raw} render={(page) => <Editor {...page} />} />
}
