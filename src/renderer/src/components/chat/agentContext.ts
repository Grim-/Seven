import { createContext, useContext } from 'react'
import type { AgentProfile } from '@shared/types'

export const AgentRef = createContext<AgentProfile | null>(null)

export function useRoleplay(): boolean {
  return useContext(AgentRef)?.roleplay === true
}
