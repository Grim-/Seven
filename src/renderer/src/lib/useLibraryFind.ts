import { useEffect, useState } from 'react'
import type { LibraryHit } from '@shared/types'
import { engine } from './ipc'
import { noteFailure } from '../store/problems'

export function useLibraryFind(query: string, kind: string | null, limit: number, enabled = true, delay = 120): LibraryHit[] | null {
  const [hits, setHits] = useState<LibraryHit[] | null>(null)
  useEffect(() => {
    if (!enabled) return setHits(null)
    let live = true
    const timer = setTimeout(() => {
      void engine('library.find', { query, kind, limit })
        .then((h) => live && setHits(h))
        .catch(noteFailure('library', 'Could not search', () => live && setHits([])))
    }, delay)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [query, kind, limit, enabled, delay])
  return hits
}
