import { useEffect, useState } from 'react'
import type { DeckEntry, DeckRef } from '@shared/cardDecks'
import { engine } from '../../lib/ipc'
import { usePage } from '../../store/data'
import { readCounts } from './model'

export interface DeckInUse {
  ref: DeckRef
  id: string | null
  entries: DeckEntry[]
  refresh: () => void
}

export function useDeckInUse(ref: DeckRef | null, watch: unknown = null, always = false): DeckInUse | null {
  const key = JSON.stringify([ref, watch])
  const [found, setFound] = useState<{ deck: string | null; set: string | null } | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!ref) return setFound(null)
    let live = true
    void engine('decks.find', { ref })
      .then((f) => live && setFound(f))
      .catch(() => live && setFound(null))
    return () => {
      live = false
    }
  }, [key, tick])
  const page = usePage(found?.deck ?? found?.set ?? null)
  if (!ref || !found || (!always && !found.deck && !found.set)) return null
  return { ref, id: found.deck, entries: page ? readCounts(page.data, page.title).cards : [], refresh: () => setTick((t) => t + 1) }
}
