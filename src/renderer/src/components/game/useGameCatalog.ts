import { useEffect, useMemo, useState } from 'react'
import { catalogFrom, type CatalogData } from '@shared/game/defs'
import type { Catalog } from '@shared/game/core'
import { engine, on } from '../../lib/ipc'
import { useRuleSet } from './ruleSet'

export function useGameCatalog(ruleSet?: string | null): Catalog | null {
  const inherited = useRuleSet()
  const set = ruleSet ?? inherited
  const [data, setData] = useState<CatalogData | null>(null)
  useEffect(() => {
    setData(null)
    if (!set) return
    let live = true
    const load = () =>
      void engine('game.catalog', { ruleSet: set })
        .then((d) => live && setData(d))
        .catch(() => undefined)
    load()
    const off = on('game.changed', load)
    return () => {
      live = false
      off()
    }
  }, [set])
  return useMemo(() => (data ? catalogFrom(data) : null), [data])
}
