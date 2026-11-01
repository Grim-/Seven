import { ToolError, optBool, optStr, str, type ToolContext, type ToolDef } from '../../engine/tools/types'
import { gateRemember } from '../../engine/permissions/gate'
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
    if (pin) await gateRemember(ctx.permissions, 'your pinned memories', text)
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

const recall: ToolDef = {
  name: 'recall',
  group: 'mind',
  needsWorkspace: false,
  command: true,
  activity: () => 'recalling',
  description: 'Search your memories and journal (every turn you have taken). A memory matches if it contains any of the words (part of a word counts: "interest" finds "interests"); put "exact phrases" in double quotes. Related memories and journal entries by meaning come after. With id, read one memory or journal entry in full. With neither, list your newest memories and how many you have.',
  params: {
    type: 'object',
    properties: {
      query: { type: ['string', 'null'], description: 'Words to look for, e.g. music games "best friend"' },
      id: { type: ['string', 'null'], description: 'A memory id (m_…) or journal id (j_…) to read in full' }
    }
  },
  async execute(params, ctx) {
    const agentId = agentOf(ctx)
    const id = optStr(params, 'id')?.trim()
    if (id) {
      const memory = minds.memory(agentId, id)
      if (memory) return `${memory.text}\n\n(${memory.pinned ? 'pinned, ' : ''}kept ${when(memory.createdAt)}${memory.updatedAt !== memory.createdAt ? `, changed ${when(memory.updatedAt)}` : ''})`
      const entry = minds.journalEntry(agentId, id)
      if (!entry) throw new ToolError(`There is no memory or journal entry ${id}. Call recall with id null and no query to list your memories, or with a query to find memories and journal entries with their ids.`)
      const tools = entry.tools.map((t) => `- ${t.name}: ${t.result.slice(0, 300)}`).join('\n')
      return `${when(entry.at)}, chat "${entry.sessionTitle}"\n\nUser: ${entry.user}\n\nYou: ${entry.reply}${tools ? `\n\nTools:\n${tools}` : ''}`
    }
    const query = optStr(params, 'query')?.trim()
    const all = minds.memories(agentId)
    if (!query) {
      if (!all.length) return { text: 'You have no memories yet. Keep one with remember.', empty: true }
      const pinned = all.filter((m) => m.pinned).length
      const newest = [...all].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20)
      return `You have ${all.length} ${all.length === 1 ? 'memory' : 'memories'} (${pinned} pinned). ${newest.length < all.length ? `The newest ${newest.length}:` : 'Newest first:'}\n${newest.map(memoryLine).join('\n')}${newest.length < all.length ? '\nSearch with query to find older ones.' : ''}`
    }
    const words = searchWords(query)
    const matched = all
      .map((m) => {
        const text = m.text.toLowerCase()
        return { m, n: words.filter((w) => text.includes(w)).length }
      })
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n || b.m.updatedAt - a.m.updatedAt)
      .map((x) => x.m)
    const shown = new Set(matched.slice(0, 15).map((m) => m.id))
    const related = (await minds.search(agentId, query, 8)).filter((h) => !(h.source === 'memory' && shown.has(h.ref)))
    if (!matched.length && !related.length) return { text: `Nothing found for "${query}" in your ${all.length} memories or your journal. Try other or shorter words, or call recall with query null to list your newest memories.`, empty: true }
    const parts: string[] = []
    if (matched.length) parts.push(`Memories with ${words.map((w) => `"${w}"`).join(' or ')} (${matched.length} of ${all.length}):\n${matched.slice(0, 15).map(memoryLine).join('\n')}${matched.length > 15 ? `\n…and ${matched.length - 15} more; add words to narrow it.` : ''}`)
    if (related.length) parts.push(`${matched.length ? 'Also related' : 'No memory has those words. Related'} by meaning:\n${related.map((h) => (h.source === 'memory' ? `- memory ${h.ref}: ${h.text}` : `- journal ${h.ref}, ${when(h.at)}: ${h.text.slice(0, 500)}`)).join('\n')}`)
    return parts.join('\n\n')
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
    return { text: conclusion, view: { kind: 'thought', title: 'Reasoning', data: thought } }
  }
}

export const MIND_TOOLS: ToolDef[] = [remember, recall, forget, think, reason]
