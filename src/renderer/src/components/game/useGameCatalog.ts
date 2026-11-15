import { useEffect, useMemo, useState } from 'react'
import { catalogFrom, type CatalogData } from '@shared/game/defs'
import type { Catalog } from '@shared/game/core'
import { engine, on } from '../../lib/ipc'
import { noteFailure } from '../../store/problems'

export function useGameCatalog(): Catalog | null {
  const [data, setData] = useState<CatalogData | null>(null)
  useEffect(() => {
    let live = true
    const load = () =>
      void engine('game.catalog')
        .then((d) => live && setData(d))
        .catch(noteFailure('game', 'Could not load the game catalog'))
    load()
    const off = on('game.changed', load)
    return () => {
      live = false
      off()
    }
  }, [])
  return useMemo(() => (data ? catalogFrom(data) : null), [data])
}
