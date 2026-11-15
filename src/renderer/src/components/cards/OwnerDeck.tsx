import { Plus } from 'lucide-react'
import type { DeckOwner } from '@shared/cardDecks'
import { Button, EmptyState } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { DeckEditor } from './DeckEditor'
import { useDeckInUse } from './useDeckInUse'

export function OwnerDeck({ owner, giving }: { owner: DeckOwner; giving?: boolean }) {
  const deck = useDeckInUse(owner)
  if (!deck) return null
  if (deck.id) return <DeckEditor id={deck.id} giving={giving} />
  const start = () => void engine('decks.find', { ref: owner, make: true }).then(deck.refresh, failed('Could not start the deck'))
  return (
    <EmptyState
      title="No cards yet"
      action={
        <Button size="sm" variant="primary" icon={<Plus />} onClick={start}>
          Start a deck
        </Button>
      }
    >
      Cards are played from the hand in chats and in a world's Play view.
    </EmptyState>
  )
}
