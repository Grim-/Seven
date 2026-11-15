import type { ReactNode } from 'react'
import { totalOf, type DeckOwner } from '@shared/cardDecks'
import { ListRow } from '../ui'
import { useDeckInUse } from './useDeckInUse'

export function DeckOwnerRow({ owner, name, icon, note, active, onPick }: { owner: DeckOwner; name: string; icon: ReactNode; note?: string; active: boolean; onPick: (owner: DeckOwner) => void }) {
  const deck = useDeckInUse(owner)
  const count = deck?.id ? totalOf(deck.entries) : null
  return <ListRow active={active} onClick={() => onPick(owner)} icon={icon} title={name} subtitle={note} meta={count === null ? 'no deck' : `${count} cards`} />
}
