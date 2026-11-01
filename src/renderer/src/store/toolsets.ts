import { currentToolName } from '@shared/toolnames'
import { create } from 'zustand'
import type { AgentProfile, ModuleInfo, Toolset } from '@shared/types'
import { engine } from '../lib/ipc'

interface ToolsetState {
  list: Toolset[]
  load: () => Promise<void>
  set: (list: Toolset[]) => void
}

export const useToolsets = create<ToolsetState>((set) => ({
  list: [],
  load: async () => set({ list: await engine('toolsets.list') }),
  set: (list) => set({ list })
}))

export function agentGroups(agent: Pick<AgentProfile, 'modules' | 'toolsets'>, toolsets: Toolset[], modules: ModuleInfo[]): string[] {
  const names = new Set((agent.toolsets ?? []).flatMap((id) => (toolsets.find((t) => t.id === id)?.tools ?? []).map(currentToolName)))
  const fromSets = modules.filter((m) => m.tools.some((t) => names.has(t.name))).map((m) => m.id)
  return [...new Set([...agent.modules, ...fromSets])]
}
