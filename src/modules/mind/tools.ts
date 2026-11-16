import { ToolError, optBool, optStr, str, type ToolContext, type ToolDef } from '../../engine/tools/types'
import { gateRemember, gateTool, shouldRunCustomGate } from '../../engine/permissions/gate'
import { minds } from '../../engine/mind/store'
import { reason as runReason, styleBrief, styleFor, styleNames } from '../../engine/mind/reason'
import { agentAccess } from '../../engine/agents/access'
import { relationshipLine, searchRelationships, type RelationshipEntry } from '@shared/relationships'
import { applyRelationshipRemove, applyRelationshipUpsert, extractRelationshipPatch, formatRelationshipChange, formatRelationshipDetail, removeRelationshipSchema, setRelationshipSchema } from '../../engine/relationships'

function agentOf(ctx: ToolContext): string {
  if (!ctx.agentId) throw new ToolError('Only an agent has a mind')
  return ctx.agentId
}

function when(at: number): string {
  return new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

const SKIP = new Set(['of', 'is', 'in', 'on', 'to', 'at', 'an', 'or', 'it', 'me', 'my', 'we', 'be', 'do', 'so', 'as', 'by', 'if', 'the', 'and', 'for', 'with', 'that', 'this', 'from', 'what', 'about', 'are', 'was', 'has', 'have', 'you', 'your', 'his', 'her', 'its', 'who', 'how', 'why', 'when', 'where', 'does', 'did', 'any', 'all'])

function searchWords(query: string): string[] {
  const phrases: string[] = []
  const rest = query.replace(/"([^"]+)"/g, (_m, phrase: string) => {
    if (phrase.trim()) phrases.push(phrase.trim().toLowerCase())
    return ' '
  })
  const words = rest
    .toLowerCase()
    .split(/[^\p{L}\p{N}_-]+/u)
    .filter((w) => w.length >= 2 && !SKIP.has(w))
  return [...new Set([...phrases, ...words])]
}

function memoryLine(m: { id: string; pinned: boolean; text: string }): string {
  return `- ${m.id}${m.pinned ? ' (pinned)' : ''}: ${m.text}`
}

const remember: ToolDef = {
  name: 'remember',
  group: 'mind',
  needsWorkspace: false,
  command: true,
  activity: () => 'remembering',
  description: 'Keep a new memory: one thing, in a sentence or two. pin=true keeps it in every chat (the user approves); otherwise find it later with recall. To change a memory, forget the old one and remember the new text.',
  params: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The memory' },
      pin: { type: ['boolean', 'null'], description: 'true: in every chat. null or false: recalled when needed' }
    }
  },
  async execute(params, ctx) {
    const agentId = agentOf(ctx)
    const text = str(params, 'text').trim()
    const pin = optBool(params, 'pin') ?? false
    if (shouldRunCustomGate(ctx.permissions)) {
      if (pin) await gateRemember(ctx.permissions, 'your pinned memories', text)
      else if (ctx.permissions.mode === 'ask') await gateTool(ctx.permissions, { name: 'remember', group: 'mind', permission: 'ask' }, params)
    }
    const memory = await minds.remember(agentId, { id: null, text, pinned: pin, by: 'agent', sessionId: ctx.sessionId })
    return `Remembered (${memory.id}${memory.pinned ? ', pinned' : ''}).`
  }
}

const forget: ToolDef = {
  name: 'forget',
  group: 'mind',
  needsWorkspace: false,
  activity: () => 'forgetting',
  description: 'Remove one of your memories by id.',
  params: { type: 'object', properties: { id: { type: 'string', description: 'Memory id' } } },
  async execute(params, ctx) {
    try {
      minds.forget(agentOf(ctx), str(params, 'id'), ctx.sessionId)
    } catch (err) {
      throw new ToolError(err instanceof Error ? err.message : String(err))
    }
    return 'Forgotten.'
  }
}

const RECALL_TYPES = ['all', 'memory', 'journal', 'relationship'] as const

const recall: ToolDef = {
  name: 'recall',
  group: 'mind',
  needsWorkspace: false,
  command: true,
  activity: () => 'recalling',
  description: 'Search your memories, journal (every turn you have taken), and relationship table. A memory or relationship matches keywords; related memories, journal turns, and relationships by meaning follow via semantic search. With id, read one memory (m_…), journal turn (j_…), or relationship (rel_…) in full. With neither, list recent memories and relationships.',
  params: {
    type: 'object',
    properties: {
      query: { type: ['string', 'null'], description: 'Words to look for, e.g. music games "best friend" Ironhaven' },
      id: { type: ['string', 'null'], description: 'A memory id (m_…), journal id (j_…), or relationship id (rel_…) to read in full' },
      type: { type: ['string', 'null'], enum: [...RECALL_TYPES, null], description: "Filter: 'all' (default), 'memory', 'journal', or 'relationship'" }
    }
  },
  async execute(params, ctx) {
    const agentId = agentOf(ctx)
    const agent = agentAccess.get(agentId)
    const rels: RelationshipEntry[] = agent?.relationships ?? []
    const id = optStr(params, 'id')?.trim()
    if (id) {
      const rel = rels.find((r) => r.id === id)
      if (rel) return formatRelationshipDetail(agent?.name ?? 'You', rel)
      const memory = minds.memory(agentId, id)
      if (memory) return `${memory.text}\n\n(${memory.pinned ? 'pinned, ' : ''}kept ${when(memory.createdAt)}${memory.updatedAt !== memory.createdAt ? `, changed ${when(memory.updatedAt)}` : ''})`
      const entry = minds.journalEntry(agentId, id)
      if (!entry) throw new ToolError(`There is no memory, journal entry, or relationship ${id}. Call recall with id null and no query to list yours, or with a query to find ids.`)
      const tools = entry.tools.map((t) => `- ${t.name}: ${t.result.slice(0, 300)}`).join('\n')
      return `${when(entry.at)}, chat "${entry.sessionTitle}"\n\nUser: ${entry.user}\n\nYou: ${entry.reply}${tools ? `\n\nTools:\n${tools}` : ''}`
    }

    const rawType = optStr(params, 'type')?.trim().toLowerCase() ?? 'all'
    if (!(RECALL_TYPES as readonly string[]).includes(rawType)) {
      throw new ToolError(`type must be one of: ${RECALL_TYPES.join(', ')}.`)
    }
    const query = optStr(params, 'query')?.trim()
    const all = minds.memories(agentId)
    if (!query) {
      if (rawType === 'relationship') {
        if (!rels.length) return { text: 'You have no entries in your relationship table yet. Add one with set_relationship.', empty: true }
        const sortedRels = [...rels].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt)
        return `Relationships (${rels.length}):\n${sortedRels.slice(0, 25).map((r) => relationshipLine(r, { includeSecret: true })).join('\n')}${sortedRels.length > 25 ? `\n…and ${sortedRels.length - 25} more; search with query.` : ''}`
      }
      if (!all.length && !rels.length) return { text: 'You have no memories or relationships yet. Keep memories with remember or bonds with set_relationship.', empty: true }
      const pinned = all.filter((m) => m.pinned).length
      const newest = [...all].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20)
      const sections: string[] = []
      if (all.length) {
        sections.push(`You have ${all.length} ${all.length === 1 ? 'memory' : 'memories'} (${pinned} pinned). ${newest.length < all.length ? `The newest ${newest.length}:` : 'Newest first:'}\n${newest.map(memoryLine).join('\n')}${newest.length < all.length ? '\nSearch with query to find older ones.' : ''}`)
      }
      if (rels.length && rawType === 'all') {
        const pinnedRels = rels.filter((r) => r.pinned).length
        const shownRels = [...rels].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt).slice(0, 10)
        sections.push(`Relationships (${rels.length}, ${pinnedRels} pinned):\n${shownRels.map((r) => relationshipLine(r, { includeSecret: true })).join('\n')}${rels.length > 10 ? '\nSearch with query or type="relationship" for the rest.' : ''}`)
      }
      return sections.join('\n\n')
    }

    const words = searchWords(query)
    const matched = rawType === 'all' || rawType === 'memory'
      ? all
          .map((m) => {
            const text = m.text.toLowerCase()
            return { m, n: words.filter((w) => text.includes(w)).length }
          })
          .filter((x) => x.n > 0)
          .sort((a, b) => b.n - a.n || b.m.updatedAt - a.m.updatedAt)
          .map((x) => x.m)
      : []
    const matchedRels = rawType === 'all' || rawType === 'relationship'
      ? searchRelationships(rels, query).slice(0, 15).map((x) => x.entry)
      : []

    const shownMem = new Set(matched.slice(0, 15).map((m) => m.id))
    const shownRel = new Set(matchedRels.map((r) => r.id))
    const sources: ('memory' | 'journal' | 'relationship')[] | undefined =
      rawType === 'all' ? undefined : [rawType as 'memory' | 'journal' | 'relationship']
    const related = (await minds.search(agentId, query, 8, sources)).filter(
      (h) => !(h.source === 'memory' && shownMem.has(h.ref)) && !(h.source === 'relationship' && shownRel.has(h.ref))
    )

    if (!matched.length && !matchedRels.length && !related.length) {
      return { text: `Nothing found for "${query}" in your memories, journal, or relationships. Try other or shorter words, or call recall with query null.`, empty: true }
    }
    const parts: string[] = []
    if (matched.length) parts.push(`Memories with ${words.map((w) => `"${w}"`).join(' or ')} (${matched.length} of ${all.length}):\n${matched.slice(0, 15).map(memoryLine).join('\n')}${matched.length > 15 ? `\n…and ${matched.length - 15} more; add words to narrow it.` : ''}`)
    if (matchedRels.length) parts.push(`Relationships (${matchedRels.length} of ${rels.length}):\n${matchedRels.map((r) => relationshipLine(r, { includeSecret: true })).join('\n')}`)
    if (related.length) {
      parts.push(
        `${matched.length || matchedRels.length ? 'Also related' : 'Related'} by meaning:\n${related
          .map((h) => (h.source === 'memory' ? `- memory ${h.ref}: ${h.text}` : h.source === 'relationship' ? `- relationship ${h.ref}: ${h.text}` : `- journal ${h.ref}, ${when(h.at)}: ${h.text.slice(0, 500)}`))
          .join('\n')}`
      )
    }
    return parts.join('\n\n')
  }
}

const setRelationship: ToolDef = {
  name: 'set_relationship',
  group: 'mind',
  needsWorkspace: false,
  activity: (params) => `updating relationship${typeof params.target === 'string' && params.target.trim() ? `: ${params.target.trim()}` : ''}`,
  description: 'Add or update an entry in your own relationship table (person, place, thing, faction, concept, or event). Updates an existing match for target or id in place; null keeps existing fields.',
  params: setRelationshipSchema(),
  async execute(params, ctx) {
    const agentId = agentOf(ctx)
    const agent = agentAccess.get(agentId)
    if (!agent) throw new ToolError('Agent profile not found.')
    const patch = extractRelationshipPatch(params, { agentId })
    if (shouldRunCustomGate(ctx.permissions)) {
      if (patch.pinned === true) await gateRemember(ctx.permissions, 'your pinned relationships', `${patch.target ?? patch.id ?? ''}`)
      else if (ctx.permissions.mode === 'ask') await gateTool(ctx.permissions, { name: 'set_relationship', group: 'mind', permission: 'ask' }, params)
    }
    const { list, entry, created } = applyRelationshipUpsert(agent.relationships ?? [], patch)
    agentAccess.setRelationships(agentId, list)
    return formatRelationshipChange(created ? 'Added' : 'Updated', 'your', entry)
  }
}

const removeRelationshipTool: ToolDef = {
  name: 'remove_relationship',
  group: 'mind',
  needsWorkspace: false,
  activity: () => 'removing relationship',
  description: 'Remove an entry from your own relationship table by id (rel_…) or target name.',
  params: removeRelationshipSchema(),
  async execute(params, ctx) {
    const agentId = agentOf(ctx)
    const agent = agentAccess.get(agentId)
    if (!agent) throw new ToolError('Agent profile not found.')
    const targetOrId = str(params, 'target_or_id').trim()
    const { list, removed } = applyRelationshipRemove(agent.relationships ?? [], targetOrId, optStr(params, 'category'))
    agentAccess.setRelationships(agentId, list)
    return `Removed relationship with ${removed.target} (${removed.id}).`
  }
}

const think: ToolDef = {
  name: 'think',
  group: 'mind',
  needsWorkspace: false,
  activity: () => 'thinking',
  description: 'Have a thought: write your reasoning and the conclusion it leads to. You keep the conclusion.',
  params: {
    type: 'object',
    properties: {
      reasoning: { type: 'string', description: 'Your reasoning' },
      conclusion: { type: 'string', description: 'What you conclude' }
    }
  },
  async execute(params, ctx) {
    const conclusion = str(params, 'conclusion').trim()
    if (!conclusion) throw new ToolError('Give conclusion: what your reasoning leads to, in a sentence.')
    const thought = minds.think(agentOf(ctx), { sessionId: ctx.sessionId, kind: 'think', style: null, question: '', reasoning: str(params, 'reasoning').trim(), conclusion })
    return { text: conclusion, view: { kind: 'thought', title: 'Thought', data: thought } }
  }
}

const reason: ToolDef = {
  name: 'reason',
  group: 'mind',
  needsWorkspace: false,
  maxRepeats: 3,
  activity: () => 'reasoning',
  description: 'Your scratch pad for working something out in a reasoning style. Call it with just the question to get the style to reason in; then call it again with your reasoning and conclusion, which are kept. Uses no extra memory. style picks a reasoning style; null uses yours.',
  params: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'What to work out' },
      reasoning: { type: ['string', 'null'], description: 'Your reasoning, written in the style' },
      conclusion: { type: ['string', 'null'], description: 'What you conclude' },
      style: { type: ['string', 'null'], description: 'A reasoning style name, or null for yours' }
    }
  },
  async execute(params, ctx) {
    const question = str(params, 'question').trim()
    if (!question) throw new ToolError(`Give a question. Styles: ${styleNames()}`)
    const style = styleFor(agentOf(ctx), ctx.sessionId, optStr(params, 'style'))
    const reasoning = optStr(params, 'reasoning')?.trim() ?? ''
    const conclusion = optStr(params, 'conclusion')?.trim() ?? ''
    if (!reasoning || !conclusion) return `${styleBrief(style)}\n\nReason about "${question}" this way, then call reason again with the same question, your reasoning and your conclusion.`
    const thought = runReason({ agentId: agentOf(ctx), sessionId: ctx.sessionId, question, reasoning, conclusion, style })
    const filter = style?.constraints?.trim() ? `\n\n[Filter next output through: ${style.constraints.trim()}]` : ''
    return { text: `${conclusion}${filter}`, view: { kind: 'thought', title: 'Reasoning', data: thought } }
  }
}

export const MIND_TOOLS: ToolDef[] = [remember, recall, forget, setRelationship, removeRelationshipTool, think, reason]
