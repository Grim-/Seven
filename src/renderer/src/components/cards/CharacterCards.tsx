import { Layers, Minus, Plus } from 'lucide-react'
import { showName } from '@shared/ids'
import { totalOf, type DeckRef } from '@shared/cardDecks'
import { Button, EmptyState, Eyebrow, openMenu } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { entryMenuAt } from '../../views/data/entryMenu'
import { CountCards } from './DeckScreen'
import { CARD_TYPE, SET_TYPE, useTypePages } from './model'
import { useDeckInUse } from './useDeckInUse'

export function CharacterCards({ sheet }: { sheet: string }) {
  const deck = useDeckInUse({ character: sheet }, null, true)
  const cards = useTypePages(CARD_TYPE)
  const sets = useTypePages(SET_TYPE)
  if (!deck) return null
  const ref: DeckRef = deck.ref
  const done = () => deck.refresh()
  const addCard = (card: string) => void engine('decks.add', { ref, card, by: 1 }).then(done, failed('Could not add the card'))
  const addSet = (set: string) => void engine('decks.addSet', { ref, set }).then(done, failed('Could not add the set'))
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Eyebrow>Their cards</Eyebrow>
        <span className="font-mono text-[11px] text-dim">{totalOf(deck.entries)} cards</span>
        <span className="flex-1" />
        <Button size="sm" icon={<Plus />} disabled={!cards.length} onClick={(e) => openMenu(e, 'Add a card', cards.map((c) => ({ label: showName(c.title), onSelect: () => addCard(c.title) })))}>
          Add a card
        </Button>
        <Button size="sm" variant="ghost" icon={<Layers />} disabled={!sets.length} onClick={(e) => openMenu(e, 'Add a set', sets.map((s) => ({ label: showName(s.title), onSelect: () => addSet(s.id) })))}>
          Add a set
        </Button>
      </div>
      {deck.id && deck.entries.length ? (
        <CountCards
          id={deck.id}
          onCardMenu={(e, card, cardId) => {
            const take = { label: 'Take one away', icon: <Minus />, onSelect: () => void engine('decks.take', { ref, card }).then(done, failed('Could not take it')) }
            if (cardId) entryMenuAt(e, 'cards.card', cardId, card, [take])
            else openMenu(e, showName(card), [take])
          }}
        />
      ) : (
        <EmptyState title="No cards yet">Add cards or a whole card set. They play them from their hand in chats and in a world's Play view.</EmptyState>
      )}
    </div>
  )
}
