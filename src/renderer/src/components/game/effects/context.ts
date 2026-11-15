import { createContext, useContext } from 'react'
import type { EffectsEditing } from './useEffectsEditing'
import type { PieceChoice } from './pieces'

export interface EffectsScope extends EffectsEditing {
  choices: PieceChoice[]
}

export const EffectsContext = createContext<EffectsScope | null>(null)

export function useEffectsScope(): EffectsScope {
  const scope = useContext(EffectsContext)
  if (!scope) throw new Error('Effects pieces must be inside an EffectsEditor.')
  return scope
}
