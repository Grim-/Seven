import type { MouseEvent, ReactNode } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { showName, toId } from '@shared/ids'
import { addCards, countOf, totalOf } from '@shared/cardDecks'
import { EmptyState, FaceGrid, openMenu, type MenuItem } from '../ui'
import { useModulePageState } from '../../lib/modulePage'
import { entryMenuAt } from '../../views/data/entryMenu'
import { AddonTitle } from '../data/AddonPage'
import { CardAdder } from './CardAdder'
import { DeckCardTile } from './DeckCardTile'
import { CARD_TYPE, readCounts, useTypePages, type CardCounts } from './model'

export type Counts = ReturnType<typeof readCounts>

export interface CountsEdit {
  list: Counts
  set: (change: (d: Counts) => Counts) => void
  addSet: (set: CardCounts) => void
}

export function CountsEditor({ pageId, title, start, what, extra }: { pageId: string; title: string; start: Counts; what: string; extra?: (edit: CountsEdit) => ReactNode }) {
  const saver = useModulePageState<Counts>(pageId, start)
  const list = saver.value
  const cards = useTypePages(CARD_TYPE)
  const add = (name: string, by: number) => saver.set((d) => ({ ...d, cards: addCards(d.cards, name, by) }))
  const addSet = (set: CardCounts) => saver.set((d) => ({ ...d, cards: set.cards.reduce((next, e) => addCards(next, e.card, e.count), d.cards) }))
  const metaOf = (name: string) => cards.find((c) => toId(c.title) === toId(name))
  const items = (card: string): MenuItem[] => {
    const count = countOf(list.cards, card)
    return [
      { label: 'One more', icon: <Plus />, onSelect: () => add(card, 1) },
      { label: 'One less', icon: <Minus />, disabled: count < 1, onSelect: () => add(card, -1) },
      { label: 'Take them all out', icon: <Trash2 />, danger: true, disabled: count < 1, onSelect: () => add(card, -count) }
    ]
  }
  const menu = (e: MouseEvent, card: string) => {
    const meta = metaOf(card)
    if (meta) entryMenuAt(e, 'card', meta.id, card, items(card))
    else openMenu(e, showName(card), items(card))
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <AddonTitle pageId={pageId} title={title} status={saver.status} error={saver.error} onRenamed={(name) => saver.set((d) => ({ ...d, name }))} />
        <span className="font-mono text-[12px] font-bold text-accent">{totalOf(list.cards)} cards</span>
        <span className="flex-1" />
        {extra?.({ list, set: saver.set, addSet })}
      </div>
      <div className="flex min-h-0 flex-1 gap-4 phone:flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {list.cards.length ? (
            <FaceGrid>
              {list.cards.map((e) => (
                <DeckCardTile key={e.card} name={e.card} cardId={metaOf(e.card)?.id ?? null} count={e.count} onCount={(n) => add(e.card, n - e.count)} onMenu={(ev) => menu(ev, e.card)} />
              ))}
            </FaceGrid>
          ) : (
            <EmptyState title={`Nothing in this ${what}`}>Add cards from the list beside it.</EmptyState>
          )}
        </div>
        <CardAdder have={list.cards} onAdd={(name) => add(name, 1)} onMenu={menu} />
      </div>
    </div>
  )
}
