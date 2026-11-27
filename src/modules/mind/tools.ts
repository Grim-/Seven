import { ToolError, optBool, optStr, str, type ToolContext, type ToolDef } from '../../engine/tools/types'
import { gateRemember, gateTool, shouldRunCustomGate } from '../../engine/permissions/gate'
import { minds } from '../../engine/mind/store'
import { reason as runReason, styleBrief, styleFor, styleNames } from '../../engine/mind/reason'

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

const agentRemember: ToolDef = {
  name: 'agent_remember',
  group: 'mind',
  needsWorkspace: false,
  command: true,
  activity: () => 'remembering',
  description: 'Keep a new memory in your own Agent Mind (about the user, their preferences, or out-of-character notes — NOT for a character sheet). One thing, in a sentence or two. pin=true keeps it in every chat (the user approves); otherwise find it later with agent_recall.',
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
      else if (ctx.permissions.mode === 'ask') await gateTool(ctx.permissions, { name: 'agent_remember', group: 'mind', permission: 'ask' }, params)
    }
    const memory = await minds.remember(agentId, { id: null, text, pinned: pin, by: 'agent', sessionId: ctx.sessionId })
    return `Remembered (${memory.id}${memory.pinned ? ', pinned' : ''}).`
  }
}

const RECALL_TYPES = ['all', 'memory', 'journal'] as const

const agentRecall: ToolDef = {
  name: 'agent_recall',
  group: 'mind',
  needsWorkspace: false,
  command: true,
  lookup: true,
  activity: () => 'recalling',
  description: 'Search your own Agent Mind memories and journal (every turn you have taken) — NOT character sheet knowledge or character relations. A memory matches keywords; related memories and journal turns by meaning follow via semantic search. With id, read one memory (m_…) or journal turn (j_…) in full. With neither, list recent memories.',
  params: {
    type: 'object',
    properties: {
      query: { type: ['string', 'null'], description: 'Words to look for, e.g. music games "best friend" Ironhaven' },
      id: { type: ['string', 'null'], description: 'A memory id (m_…) or journal id (j_…) to read in full' },
      type: { type: ['string', 'null'], enum: [...RECALL_TYPES, null], description: "Filter: 'all' (default), 'memory', or 'journal'" }
    }
  },
  async execute(params, ctx) {
    const agentId = agentOf(ctx)
    const id = optStr(params, 'id')?.trim()
    if (id) {
      const memory = minds.memory(agentId, id)
      if (memory) return `${memory.text}\n\n(${memory.pinned ? 'pinned, ' : ''}kept ${when(memory.createdAt)}${memory.updatedAt !== memory.createdAt ? `, changed ${when(memory.updatedAt)}` : ''})`
      const entry = minds.journalEntry(agentId, id)
      if (!entry) throw new ToolError(`There is no agent memory or journal entry ${id}. Call agent_recall with id null and no query to list yours, or with a query to find ids.`)
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
      if (!all.length) return { text: 'You have no agent memories yet. Keep memories with agent_remember.', empty: true }
      const pinned = all.filter((m) => m.pinned).length
      const newest = [...all].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20)
      return `You have ${all.length} ${all.length === 1 ? 'memory' : 'memories'} (${pinned} pinned). ${newest.length < all.length ? `The newest ${newest.length}:` : 'Newest first:'}\n${newest.map(memoryLine).join('\n')}${newest.length < all.length ? '\nSearch with query to find older ones.' : ''}`
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

    const shownMem = new Set(matched.slice(0, 15).map((m) => m.id))
    const sources: ('memory' | 'journal')[] | undefined =
      rawType === 'all' ? ['memory', 'journal'] : [rawType as 'memory' | 'journal']
    const related = (await minds.search(agentId, query, 8, sources)).filter(
      (h) => !(h.source === 'memory' && shownMem.has(h.ref))
    )

    if (!matched.length && !related.length) {
      return { text: `Nothing found for "${query}" in your agent memories or journal. Try other or shorter words, or call agent_recall with query null.`, empty: true }
    }
    const parts: string[] = []
    if (matched.length) parts.push(`Memories with ${words.map((w) => `"${w}"`).join(' or ')} (${matched.length} of ${all.length}):\n${matched.slice(0, 15).map(memoryLine).join('\n')}${matched.length > 15 ? `\n…and ${matched.length - 15} more; add words to narrow it.` : ''}`)
    if (related.length) {
      parts.push(
        `${matched.length ? 'Also related' : 'Related'} by meaning:\n${related
          .map((h) => (h.source === 'memory' ? `- memory ${h.ref}: ${h.text}` : `- journal ${h.ref}, ${when(h.at)}: ${h.text.slice(0, 500)}`))
          .join('\n')}`
      )
    }
    return parts.join('\n\n')
  }
}

const think: ToolDef = {
  name: 'think',
  group: 'mind',
  needsWorkspace: false,
  reasoning: true,
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
  reasoning: true,
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

export const MIND_TOOLS: ToolDef[] = [agentRemember, agentRecall, think, reason]
