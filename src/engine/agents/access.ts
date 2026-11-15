import { notFound } from '@shared/errors'
import type { AgentDraft, AgentLook, AgentProfile } from '@shared/types'
import type { AgentRegistry } from './registry'

let registry: AgentRegistry | null = null

export function setAgentAccess(r: AgentRegistry): void {
  registry = r
}

export const agentAccess = {
  list(): AgentProfile[] {
    return registry?.list() ?? []
  },
  get(id: string): AgentProfile | null {
    return registry?.list().find((a) => a.id === id) ?? null
  },
  save(draft: AgentDraft): AgentProfile {
    if (!registry) throw new Error('Agents are not available')
    return registry.save(draft)
  },
  updateLook(id: string, patch: Partial<AgentLook>): AgentProfile {
    if (!registry) throw new Error('Agents are not available')
    const agent = registry.list().find((a) => a.id === id)
    if (!agent) throw notFound(new Error('This agent was deleted, so its look can no longer be changed. Carry on without changing it.'))
    return registry.save({ ...agent, look: { ...agent.look, ...patch } })
  }
}
