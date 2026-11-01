import { useState, type MouseEvent, type ReactNode } from 'react'
import { Layers, Plus } from 'lucide-react'
import { showName, toId } from '@shared/ids'
import { addCards, countOf, totalOf } from '@shared/cardDecks'
import { Button, CountStepper, Eyebrow, FaceCount, FaceGrid, KindShell, Select } from '../ui'
import { usePage } from '../../store/data'
import type { KindScreenProps } from '../../registries/kinds'
import { useModulePageState } from '../../lib/modulePage'
import { AddonPage, AddonTitle } from '../data/AddonPage'
import { LiveCard } from './LiveCard'
import { CARD_TYPE, SET_TYPE, readCounts, useTypePages, type CardCounts } from './model'

type Counts = ReturnType<typeof readCounts>

function SetPicker({ onAdd }: { onAdd: (set: CardCounts) => void }) {
  const sets = useTypePages(SET_TYPE)
  const [picked, setPicked] = useState('')
  const page = usePage(picked || null)
  return (
    <div className="flex items-center gap-1.5">
      <Select value={picked} options={[{ value: '', label: 'Pick a card set' }, ...sets.map((s) => ({ value: s.id, label: showName(s.title) }))]} onChange={setPicked} className="h-7 flex-1 text-[12px]" />
      <Button size="sm" icon={<Plus />} disabled={!page} onClick={() => page && onAdd(readCounts(page.data, page.title))}>
        Add set
      </Button>
    </div>
  )
}

function Editor({ pageId, title, start, what, extra }: { pageId: string; title: string; start: Counts; what: string; extra?: (add: (set: CardCounts) => void) => ReactNode }) {
  const saver = useModulePageState<Counts>(pageId, start)
  const list = saver.value
  const cards = useTypePages(CARD_TYPE)
  const add = (name: string, by: number) => saver.set((d) => ({ ...d, cards: addCards(d.cards, name, by) }))
  const addSet = (set: CardCounts) => saver.set((d) => ({ ...d, cards: set.cards.reduce((next, e) => addCards(next, e.card, e.count), d.cards) }))
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <AddonTitle pageId={pageId} title={title} status={saver.status} error={saver.error} onRenamed={(name) => saver.set((d) => ({ ...d, name }))} />
      <div className="flex min-h-0 flex-1 gap-4">
        <KindShell
          id="cards.deck.library"
          layouts={['deck', 'cards', 'list']}
          items={cards.map((c) => ({
            key: c.id,
            title: showName(c.title),
            icon: <Layers className="h-4 w-4" />,
            face: <LiveCard id={c.id} />,
            count: countOf(list.cards, c.title),
            updatedAt: c.updatedAt
          }))}
          onOpen={(item) => {
            const page = cards.find((c) => c.id === item.key)
            if (page) add(page.title, 1)
          }}
          empty="No cards yet. Make some with New page → Card."
        />
        <div className="flex w-72 shrink-0 flex-col gap-1 border-l border-line/40 pl-4">
          <div className="flex items-baseline justify-between">
            <Eyebrow>In this {what}</Eyebrow>
            <span className="font-mono text-[12px] font-bold text-white">{totalOf(list.cards)} cards</span>
          </div>
          {extra?.(addSet)}
          {list.cards.length ? (
            list.cards.map((e) => (
              <div key={e.card} className="shell-row flex items-center gap-2 px-1.5 py-1 text-[12.5px]">
                <span className="min-w-0 flex-1 truncate">{showName(e.card)}</span>
                <CountStepper small value={e.count} onChange={(n) => add(e.card, n - e.count)} />
              </div>
            ))
          ) : (
            <div className="text-[12.5px] text-dim">Click a card to add it.</div>
          )}
        </div>
      </div>
    </div>
  )
}

export function SetScreen({ id }: KindScreenProps) {
  return <AddonPage id={id} what="card set" read={readCounts} render={(page) => <Editor {...page} what="set" />} />
}

export function DeckScreen({ id }: KindScreenProps) {
  return <AddonPage id={id} what="card deck" read={readCounts} render={(page) => <Editor {...page} what="deck" extra={(addSet) => <SetPicker onAdd={addSet} />} />} />
}

export function CountCards({ id, onCardMenu }: { id: string; onCardMenu?: (e: MouseEvent, card: string, cardId: string | null) => void }) {
  const page = usePage(id)
  const cards = useTypePages(CARD_TYPE)
  if (!page) return null
  const list = readCounts(page.data, page.title)
  return (
    <FaceGrid>
      {list.cards.map((e) => {
        const meta = cards.find((c) => toId(c.title) === toId(e.card))
        return (
          <div key={e.card} className="relative" title={showName(e.card)} onContextMenu={onCardMenu ? (ev) => onCardMenu(ev, e.card, meta?.id ?? null) : undefined}>
            {meta ? <LiveCard id={meta.id} /> : <div className="font-mono text-[11px] text-dim">{showName(e.card)} (missing)</div>}
            <FaceCount count={e.count} />
          </div>
        )
      })}
    </FaceGrid>
  )
}
