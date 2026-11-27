import { createContext, useContext, type ReactNode } from 'react'

const WorldScopeContext = createContext<string | null>(null)

export function WorldScopeProvider({ worldId, children }: { worldId: string | null; children: ReactNode }) {
  return <WorldScopeContext.Provider value={worldId}>{children}</WorldScopeContext.Provider>
}

export function useWorldScope(): string | null {
  return useContext(WorldScopeContext)
}
