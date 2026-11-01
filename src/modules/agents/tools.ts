import { ToolError, optStr, str, type ToolDef } from '../../engine/tools/types'
import { agentAccess } from '../../engine/agents/access'
import { linkFor } from '@shared/text'

const MAX_PROMPT = 8000

function cleanText(value: string | null, max: number, what: string): string | null {
  if (value === null) return null
  if (value.length > max) throw new ToolError(`Keep the ${what} under ${max} characters`)
  return value.trim()
}

const create: ToolDef = {
  name: 'agent_create',
  group: 'agents',
  needsWorkspace: false,
  maxRepeats: 1,
  description: 'Make a new agent the user can talk to. It starts with no tools; the user gives it tools and permissions.',
  params: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string', description: 'One line: what it is for' },
      instructions: { type: 'string', description: 'Its system prompt: who it is and how it works' },
      roleplay: { type: ['boolean', 'null'], description: 'true for a character that replies in roleplay style' }
    }
  },
  async execute(params, ctx) {
    const name = str(params, 'name').trim()
    if (!name) throw new ToolError('Give name, the new agent\'s name, e.g. "Sage".')
    if (agentAccess.list().some((a) => a.name.toLowerCase() === name.toLowerCase())) throw new ToolError(`There is already an agent called ${name}. Give name a different value, or use agent_edit to change ${name}.`)
    const agent = agentAccess.save({
      name,
      description: cleanText(str(params, 'description'), 300, 'description') ?? '',
      systemPrompt: cleanText(str(params, 'instructions'), MAX_PROMPT, 'instructions') ?? '',
      roleplay: params.roleplay === true,
      modelId: null,
      sampling: {},
      workspace: null,
      modules: [],
      toolsets: [],
      permissionMode: 'ask',
      private: false,
      library: { hidden: [], chats: 'none' },
      createdBy: ctx.agentId
    })
    return `Made ${linkFor('agent', agent.name)}. It has no tools until the user gives it some in Agents.`
  }
}

const edit: ToolDef = {
  name: 'agent_edit',
  group: 'agents',
  needsWorkspace: false,
  maxRepeats: 1,
  description: 'Change the name, description, instructions or roleplay style of any agent, yourself included. null keeps a value. Its tools, model and permissions stay as the user set them.',
  params: {
    type: 'object',
    properties: {
      agent: { type: 'string', description: 'The agent to change, by name' },
      name: { type: ['string', 'null'] },
      description: { type: ['string', 'null'] },
      instructions: { type: ['string', 'null'] },
      roleplay: { type: ['boolean', 'null'] }
    }
  },
  async execute(params) {
    const ref = str(params, 'agent').trim().toLowerCase()
    const target = agentAccess.list().find((a) => a.id === ref || a.name.toLowerCase() === ref)
    if (!target) throw new ToolError(`There is no agent "${ref}". Set agent to one of: ${agentAccess.list().map((a) => a.name).join(', ')}.`)
    const name = optStr(params, 'name')?.trim()
    if (name && agentAccess.list().some((a) => a.id !== target.id && a.name.toLowerCase() === name.toLowerCase())) throw new ToolError(`There is already an agent called ${name}. Give name a different value, or null to keep the name ${target.name}.`)
    const agent = agentAccess.save({
      ...target,
      name: name || target.name,
      description: cleanText(optStr(params, 'description'), 300, 'description') ?? target.description,
      systemPrompt: cleanText(optStr(params, 'instructions'), MAX_PROMPT, 'instructions') ?? target.systemPrompt,
      roleplay: typeof params.roleplay === 'boolean' ? params.roleplay : target.roleplay
    })
    return `Changed ${linkFor('agent', agent.name)}.`
  }
}

export const AGENT_TOOLS: ToolDef[] = [create, edit]
