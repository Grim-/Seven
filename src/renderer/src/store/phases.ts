import { create } from 'zustand'
import type { TurnPhase } from '@shared/types'

interface PhaseState {
  phases: Record<string, TurnPhase>
  set: (messageId: string, phase: TurnPhase) => void
  clear: (messageId: string) => void
}

export const usePhases = create<PhaseState>((set) => ({
  phases: {},
  set: (messageId, phase) => set((s) => ({ phases: { ...s.phases, [messageId]: phase } })),
  clear: (messageId) =>
    set((s) => {
      if (!s.phases[messageId]) return s
      const phases = { ...s.phases }
      delete phases[messageId]
      return { phases }
    })
}))
