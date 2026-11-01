import { create } from 'zustand'
import type { AgentDraft, AgentProfile } from '@shared/types'
import { engine } from '../lib/ipc'

interface AgentsState {
  list: AgentProfile[]
  focus: string | null
  kindAccess: boolean
  refresh: () => Promise<void>
  save: (draft: AgentDraft) => Promise<AgentProfile>
  remove: (id: string, folder: 'keep' | 'delete') => Promise<void>
}

export const useAgents = create<AgentsState>((set) => ({
  list: [],
  focus: null,
  kindAccess: false,
  refresh: async () => {
    set({ list: await engine('agents.list') })
  },
  save: (draft) => engine('agents.save', draft),
  remove: async (id, folder) => {
    await engine('agents.delete', { id, folder })
  }
}))

export const DEFAULT_AGENT_ID = 'seven'
