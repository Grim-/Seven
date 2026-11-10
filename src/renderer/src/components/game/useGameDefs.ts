import { useEffect, useState } from 'react'
import type { GameDef } from '@shared/game/defs/defs'
import { engine, on } from '../../lib/ipc'
import { useRuleSet, useResolvedRuleSet } from './ruleSet'

export function useGameDefs(type: string, ruleSet?: string | null): { list: GameDef[] | null; failed: boolean } {
  const inherited = useRuleSet()
  const fallback = useResolvedRuleSet(ruleSet ?? inherited)
  const set = ruleSet ?? inherited ?? fallback
  const [state, setState] = useState<{ list: GameDef[] | null; failed: boolean }>({ list: null, failed: false })
  useEffect(() => {
    if (!set) return setState({ list: null, failed: true })
    let live = true
    const load = () =>
      void engine('game.list', { ruleSet: set, type })
        .then((list) => live && setState({ list, failed: false }))
        .catch(() => live && setState({ list: null, failed: true }))
    load()
    const off = on('game.changed', load)
    return () => {
      live = false
      off()
    }
  }, [type, set])
  return state
}
