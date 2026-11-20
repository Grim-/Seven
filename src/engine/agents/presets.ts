import type { PermissionMode } from '@shared/types'

export interface AgentPreset {
  id: string
  moduleId: string
  role: string
  name: string
  description: string
  systemPrompt: string
  modules: string[]
  roleplay?: boolean
  permissionMode?: PermissionMode
}

const presets = new Map<string, AgentPreset>()

export function registerAgentPreset(preset: AgentPreset): void {
  presets.set(preset.id, preset)
}

export function agentPresets(role?: string): AgentPreset[] {
  const all = [...presets.values()]
  return role ? all.filter((p) => p.role === role) : all
}

export function agentPreset(id: string): AgentPreset | null {
  return presets.get(id) ?? null
}
