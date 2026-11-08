import { createContext, useContext, type ReactNode } from 'react'
import { ruleSetFor, type RuleSet } from '@shared/game/defs'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'

const RuleSetContext = createContext<string | null>(null)

export function RuleSetProvider({ ruleSet, children }: { ruleSet: string | null; children: ReactNode }) {
  return <RuleSetContext.Provider value={ruleSet}>{children}</RuleSetContext.Provider>
}

export function useRuleSet(): string | null {
  return useContext(RuleSetContext)
}

export function useRuleSets(): RuleSet[] | null {
  return useLive(() => engine('game.ruleSets'), 'game.changed')
}

export function useResolvedRuleSet(wanted: string | null | undefined): string | null {
  const sets = useRuleSets()
  return sets ? ruleSetFor(wanted, sets) || null : null
}
