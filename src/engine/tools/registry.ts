import { currentToolName } from '@shared/toolnames'
import type { AgentProfile } from '@shared/types'
import type { ToolDef } from './types'
import { modules } from '../modules/registry'
import { linkedFolders } from '../folders/store'
import { toolsets } from '../toolsets/store'
import { hiddenActions } from '../library/kinds'

export function toolsFor(agent: Pick<AgentProfile, 'id' | 'modules' | 'workspace' | 'toolsets' | 'offTools'>): ToolDef[] {
  const all = modules.tools()
  const picked = toolsets.toolNames(agent.toolsets)
  const files = Boolean(agent.workspace) || linkedFolders.forAgent(agent.id).length > 0
  const hidden = hiddenActions(agent.id)
  for (const name of agent.offTools ?? []) hidden.add(currentToolName(name))
  const fits = (t: ToolDef) => (!t.needsWorkspace || files) && !hidden.has(t.name)
  const chosen = all.filter((t) => !t.always && (agent.modules.includes(t.group) || picked.has(t.name)) && fits(t))
  const list = chosen.length ? [...chosen, ...all.filter((t) => t.always && fits(t))] : []
  const scope = { agentId: agent.id, files: files && list.some((t) => t.group === 'read') }
  return list.map((t) => (t.forAgent ? { ...t, ...t.forAgent(scope) } : t))
}

export function findTool(name: string): ToolDef | undefined {
  return modules.tools().find((t) => t.name === name)
}
