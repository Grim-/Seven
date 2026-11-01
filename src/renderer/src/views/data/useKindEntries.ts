import { useEffect, useState } from 'react'
import type { LibraryHit } from '@shared/types'
import { engine } from '../../lib/ipc'
import { onLibraryChange } from '../../lib/library'

export function useKindEntries(kind: string): LibraryHit[] | null {
  const [list, setList] = useState<LibraryHit[] | null>(null)
  useEffect(() => {
    let live = true
    setList(null)
    const load = () =>
      void engine('library.find', { query: '', kind })
        .then((hits) => live && setList(hits.filter((h) => h.kind === kind)))
        .catch(() => live && setList([]))
    load()
    const off = onLibraryChange(load)
    return () => {
      live = false
      off()
    }
  }, [kind])
  return list
}
