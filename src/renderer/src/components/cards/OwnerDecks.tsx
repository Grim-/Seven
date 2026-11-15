import { useState } from 'react'
import type { DeckOwner } from '@shared/cardDecks'
import { DeckOwnerList, type PlayingSide } from './DeckOwnerList'
import { OwnerDeck } from './OwnerDeck'

export function OwnerDecks({ start, playing = [] }: { start: DeckOwner; playing?: PlayingSide[] }) {
  const [owner, setOwner] = useState<DeckOwner>(start)
  return (
    <div className="flex min-h-0 flex-1 gap-4 phone:flex-col">
      <DeckOwnerList owner={owner} playing={playing} onPick={setOwner} />
      <div className="flex min-h-0 flex-1 flex-col">
        <OwnerDeck key={JSON.stringify(owner)} owner={owner} giving={false} />
      </div>
    </div>
  )
}
