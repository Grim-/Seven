import { useEffect, useState } from 'react'
import type { DeckEntry, DeckRef } from '@shared/cardDecks'
import { engine } from '../../lib/ipc'
import { usePage } from '../../store/data'
import { DECK_TYPE, readCounts, useTypePages } from './model'
import { noteFailure } from '../../store/problems'

export interface DeckInUse {
  ref: DeckRef
  id: string | null
  entries: DeckEntry[]
  refresh: () => void
}

export function useDeckInUse(ref: DeckRef | null): DeckInUse | null {
  const decks = useTypePages(DECK_TYPE).map((p) => `${p.id}:${p.updatedAt}`)
  const key = JSON.stringify([ref, decks])
  const [found, setFound] = useState<{ deck: string | null } | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!ref) return setFound(null)
    let live = true
    void engine('decks.find', { ref })
      .then((f) => live && setFound(f))
      .catch(noteFailure('cards', 'Could not find the deck', () => live && setFound(null)))
    return () => {
      live = false
    }
  }, [key, tick])
  const page = usePage(found?.deck ?? null)
  if (!ref || !found) return null
  return { ref, id: found.deck, entries: page ? readCounts(page.data, page.title).cards : [], refresh: () => setTick((t) => t + 1) }
}
