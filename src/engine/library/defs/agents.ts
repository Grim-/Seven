import { linkFor } from '@shared/text'
import type { Thought } from '@shared/types'
import { agentAccess } from '../../agents/access'
import { customCommands } from '../../commands/custom'
import { commandsFor, findCommand } from '../../commands/registry'
import { minds } from '../../mind/store'
import { styles } from '../../mind/styles'
import { agentPacking } from '../../portability/kindPackers'
import { skills } from '../../skills'
import { ToolError } from '../../tools/types'
import { freeName, storePacking } from '../packing'
import { scoreDoc } from '../query'
import { registerKind } from '../kindRegistry'
import { ENTRY_WIDGET } from './runtime'
import { clip, has, withJson, type Kind, type KindContext, type KindHit } from './types'
import { bindingOrNull } from '../../worlds/ops'

export const skillKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  pack: (id) => ({ name: id, text: skills.read(id) }),
  unpack(value, how) {
    const v = (value ?? {}) as { name?: unknown; text?: unknown }
    if (typeof v.name !== 'string' || typeof v.text !== 'string') throw new Error('The skill in this picture is damaged')
    const taken = new Set(skills.list().map((s) => s.name.toLowerCase()))
    const name = how.replace ?? freeName(v.name, (n) => taken.has(n.toLowerCase()), (n, i) => `${n}-${i}`)
    skills.write(name, v.text)
    return name
  },
  group: 'Yours',
  kind: 'skill',
  remove: (id) => void skills.delete(id),
  label: 'Skill',
  textParts: ['text'],
  plural: 'Skills',
  exportable: true,
  export(id) {
    const text = skills.read(id)
    return { title: this.title(id), markdown: text, json: { name: id, text } }
  },
  icon: 'graduation-cap',
  description: 'saved instructions for doing a kind of task well',
  parts: ['text'],
  actions: [],
  title: (id) => skills.list().find((x) => x.name === id)?.title ?? id,
  available: () => true,
  search(query, limit) {
    const q = query.toLowerCase()
    return skills
      .list()
      .filter((s) => !q || has(s.name, q) || has(s.title, q) || has(s.description, q))
      .slice(0, limit)
      .map((s) => ({ kind: 'skill', id: s.name, title: s.title, at: s.updatedAt }))
  },
  line: (id) => skills.info(id)?.description ?? '',
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  resolve(ref) {
    const s = skills.list().find((x) => x.name.toLowerCase() === ref.toLowerCase() || x.title.toLowerCase() === ref.toLowerCase())
    return s?.name ?? null
  },
  full: (id) => skills.read(id) || '(empty)'
}

const mindLine = (count: number) => (count ? `${count} memor${count === 1 ? 'y' : 'ies'}` : 'nothing yet')
const memoryLine = (m: { pinned: boolean }) => (m.pinned ? 'pinned' : 'recalled when needed')

export const memoryKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  lasting: true,
  inKindList: false,
  actionsStayWhenHidden: true,
  group: 'Agents',
  kind: 'memory',
  remove(id, ctx) {
    if (!ctx.user) throw new ToolError('Only you can clear a mind')
    for (const m of minds.memories(id)) minds.forget(id, m.id, null)
  },
  label: 'Mind',
  plural: 'Minds',
  exportable: true,
  export(id, ctx) {
    if (!ctx.user) return withJson(this, id, minds.memory(ctx.agentId ?? '', id))
    const name = agentAccess.get(id)?.name ?? id
    const memories = minds.memories(id)
    const thoughts = minds.thoughts(id, null).thoughts
    const markdown = [
      `# ${name}: mind`,
      '## Memories',
      memories.map((m) => `- ${m.pinned ? '(pinned) ' : ''}${m.text}`).join('\n') || '(none)',
      '## Thoughts (latest month)',
      thoughts.map((t) => `### ${new Date(t.at).toLocaleString()}${t.style ? ` · ${t.style}` : ''}\n${t.question ? `${t.question}\n\n` : ''}${t.reasoning}\n\n**Conclusion:** ${t.conclusion}`).join('\n\n') || '(none)'
    ].join('\n\n')
    return { title: `${name} mind`, markdown, json: { agent: name, memories, thoughts } }
  },
  icon: 'brain',
  description: 'your own memories (pinned ones are in every chat); only you can read them',
  parts: [],
  actions: ['agent_remember', 'agent_recall'],
  available: (ctx) => Boolean(ctx.agentId || ctx.user),
  title: (id) => agentAccess.get(id)?.name ?? id,
  search(query, limit, ctx) {
    const q = query.toLowerCase()
    if (ctx.user) {
      return agentAccess
        .list()
        .filter((a) => !q || has(a.name, q))
        .slice(0, limit)
        .map((a) => ({ kind: 'memory', id: a.id, title: a.name, at: a.updatedAt }))
    }
    if (!ctx.agentId) return []
    return minds
      .memories(ctx.agentId)
      .filter((m) => !q || has(m.text, q))
      .slice(0, limit)
      .map((m) => ({ kind: 'memory', id: m.id, title: m.text.slice(0, 80), at: m.updatedAt }))
  },
  line(id, ctx) {
    if (ctx.user) return mindLine(minds.memories(id).length)
    const m = ctx.agentId ? minds.memory(ctx.agentId, id) : null
    return m ? memoryLine(m) : ''
  },
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  resolve(ref, ctx) {
    if (ctx.user) return agentAccess.list().find((x) => x.id === ref || x.name.toLowerCase() === ref.trim().toLowerCase())?.id ?? null
    return ctx.agentId ? (minds.memory(ctx.agentId, ref)?.id ?? null) : null
  },
  full(id, _options, ctx) {
    if (ctx.user) return clip(minds.memories(id).map((m) => `- ${m.pinned ? '(pinned) ' : ''}${m.text}`).join('\n') || '(no memories)')
    if (!ctx.agentId) throw new ToolError('Only an agent can read its own memories')
    const m = minds.memory(ctx.agentId, id)
    if (!m) throw new ToolError(`No memory ${id}`)
    return m.text
  }
}

function thoughtRef(id: string): { agentId: string; thoughtId: string } | null {
  const at = id.lastIndexOf(':')
  return at > 0 ? { agentId: id.slice(0, at), thoughtId: id.slice(at + 1) } : null
}

const thoughtLine = (t: Thought, agentName: string) => `${agentName} · ${t.kind === 'reason' ? (t.style ?? 'reason') : 'thought'}`

function thoughtText(t: Thought, agentName: string): string {
  return [`${agentName}'s ${t.kind === 'reason' ? `reasoning${t.style ? ` (${t.style})` : ''}` : 'thought'}, ${new Date(t.at).toLocaleString()}`, t.question, t.reasoning, `Conclusion: ${t.conclusion}`].filter(Boolean).join('\n\n')
}

export const thoughtKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  lasting: true,
  group: 'Agents',
  kind: 'thought',
  remove(id) {
    const ref = thoughtRef(id)
    if (ref) minds.forgetThought(ref.agentId, ref.thoughtId)
  },
  label: 'Thought',
  plural: 'Thoughts',
  exportable: true,
  icon: 'lightbulb',
  description: "agents' thoughts and reasoning; only you can read them, and you can hand one to an agent",
  parts: [],
  actions: ['think', 'reason'],
  available: (ctx) => Boolean(ctx.user),
  title(id) {
    const ref = thoughtRef(id)
    const t = ref ? minds.thought(ref.agentId, ref.thoughtId) : null
    return t ? t.conclusion.slice(0, 80) : id
  },
  search(query, limit) {
    const q = query.toLowerCase()
    const out: KindHit[] = []
    for (const a of agentAccess.list()) {
      const agentHit = !!q && has(a.name, q)
      for (const t of minds.allThoughts(a.id)) {
        if (q && !agentHit && !has(t.conclusion, q) && !has(t.question, q) && !has(t.reasoning, q)) continue
        out.push({ kind: 'thought', id: `${a.id}:${t.id}`, title: t.conclusion.slice(0, 80), at: t.at })
      }
    }
    return out.sort((x, y) => (y.at ?? 0) - (x.at ?? 0)).slice(0, limit)
  },
  resolve(ref) {
    const r = thoughtRef(ref.trim())
    if (r && minds.thought(r.agentId, r.thoughtId)) return ref.trim()
    for (const a of agentAccess.list()) if (minds.thought(a.id, ref.trim())) return `${a.id}:${ref.trim()}`
    return null
  },
  line(id) {
    const ref = thoughtRef(id)
    const t = ref ? minds.thought(ref.agentId, ref.thoughtId) : null
    return ref && t ? thoughtLine(t, agentAccess.get(ref.agentId)?.name ?? 'An agent') : ''
  },
  card(id, ctx) {
    return this.full(id, {}, ctx)
  },
  full(id) {
    const ref = thoughtRef(id)
    const t = ref ? minds.thought(ref.agentId, ref.thoughtId) : null
    if (!ref || !t) throw new ToolError(`No thought ${id}`)
    return thoughtText(t, agentAccess.get(ref.agentId)?.name ?? 'An agent')
  }
}

const styleLine = (st: { voices: { label: string }[]; instruction: string }) => (st.voices.length ? st.voices.map((v) => v.label).join(', ') : st.instruction.slice(0, 100))

export const styleKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  ...storePacking({ find: (id) => styles.find(id), names: () => styles.list().map((s) => s.name), save: (x) => styles.save(x as unknown as Parameters<typeof styles.save>[0]) }),
  group: 'Agents',
  kind: 'style',
  rename(id, name) {
    const st = styles.find(id)
    if (!st) throw new ToolError(`No reasoning style ${id}`)
    styles.save({ id: st.id, name, instruction: st.instruction, voices: st.voices, constraints: st.constraints })
  },
  remove: (id) => void styles.delete(id),
  label: 'Reasoning style',
  plural: 'Reasoning styles',
  exportable: true,
  export(id) {
    const { id: _id, updatedAt: _u, ...rest } = styles.find(id) ?? { id, updatedAt: 0 }
    return withJson(this, id, rest)
  },
  icon: 'messages-square',
  description: 'how an agent reasons when it calls reason: an instruction and optional voices that argue it out',
  parts: [],
  actions: [],
  available: () => true,
  title: (id) => styles.find(id)?.name ?? id,
  search(query, limit) {
    const q = query.toLowerCase()
    return styles
      .list()
      .filter((st) => !q || has(st.name, q) || has(st.instruction, q))
      .slice(0, limit)
      .map((st) => ({ kind: 'style', id: st.id, title: st.name, at: st.updatedAt || undefined }))
  },
  line: (id) => {
    const st = styles.find(id)
    return st ? styleLine(st) : ''
  },
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  resolve: (ref) => styles.find(ref)?.id ?? null,
  full(id) {
    const st = styles.find(id)
    if (!st) throw new ToolError(`No reasoning style ${id}`)
    return [
      `# ${st.name}`,
      st.instruction,
      st.voices.length ? st.voices.map((v) => `- ${v.label}: ${v.line}`).join('\n') : '',
      st.constraints?.trim() ? `## Constraints\n${st.constraints.trim()}` : ''
    ].filter(Boolean).join('\n\n')
  }
}

function visibleAgents(ctx: KindContext) {
  const all = agentAccess.list()
  if (ctx.user || !ctx.agentId) return all
  const me = agentAccess.get(ctx.agentId)
  return all.filter((a) => !a.private || me?.private)
}

const agentLine = (a: { description: string; modules: string[] }) => a.description || `${a.modules.length} tool groups`

export const agentKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Agents',
  kind: 'agent',
  ...agentPacking(),
  label: 'Agent',
  plural: 'Agents',
  exportable: true,
  export(id) {
    const a = agentAccess.get(id)
    if (!a) throw new ToolError(`No agent ${id}`)
    const { look: _l, ...rest } = a
    return { title: a.name, markdown: `# ${a.name}\n\n${a.description}\n\n## Instructions\n\n${a.systemPrompt}`, json: rest }
  },
  icon: 'bot',
  description: 'the agents the user can talk to: what each one is for, its tools and model',
  parts: [],
  actions: ['agent_create', 'agent_edit'],
  available: () => true,
  title: (id) => agentAccess.get(id)?.name ?? id,
  search(query, limit, ctx) {
    const trimmed = query.trim()
    const visible = visibleAgents(ctx)
    if (!trimmed) return visible.slice(0, limit).map((a) => ({ kind: 'agent', id: a.id, title: a.name, at: a.updatedAt }))
    return visible
      .flatMap((a) => {
        const m = scoreDoc(trimmed, {
          title: a.name,
          labels: ['agent', 'agents', ...(a.roleplay ? ['roleplay'] : [])],
          fields: [{ name: 'Description', value: a.description }],
          body: a.systemPrompt
        })
        return m ? [{ kind: 'agent', id: a.id, title: a.name, at: a.updatedAt, ...(m.snippet ? { excerpt: m.snippet } : {}), _score: m.score }] : []
      })
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score: _s, ...h }) => h)
  },
  line: (id, ctx) => {
    const a = visibleAgents(ctx).find((x) => x.id === id)
    return a ? agentLine(a) : ''
  },
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  resolve: (ref, ctx) => visibleAgents(ctx).find((a) => a.id === ref || a.name.toLowerCase() === ref.trim().toLowerCase())?.id ?? null,
  full(id, _options, ctx) {
    const a = visibleAgents(ctx).find((x) => x.id === id)
    if (!a) throw new ToolError(`No agent ${id}`)
    const maker = a.createdBy ? agentAccess.get(a.createdBy)?.name ?? 'another agent' : null
    const home = bindingOrNull(a.id)
    const lines = [
      `# ${a.name}`,
      a.description || '(no description)',
      `Tools: ${a.modules.length ? a.modules.join(', ') : 'none yet'}${a.toolsets?.length ? `; toolsets ${a.toolsets.join(', ')}` : ''}. Model: ${a.modelId ?? 'whichever is loaded'}.${a.roleplay ? ' Replies in roleplay style.' : ''}${home ? ` Lives in world ${home.worldId} as ${home.type} ${home.id}.` : ''}${maker ? ` Made by ${maker}.` : ''}`,
      `Link: ${linkFor('agent', a.name)}`,
      a.systemPrompt.trim() ? `Instructions:\n${a.systemPrompt.trim().slice(0, 2000)}${a.systemPrompt.length > 2000 ? '\n...' : ''}` : 'No instructions.'
    ]
    return lines.join('\n\n')
  }
}

export const commandKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  ...storePacking({ find: (id) => customCommands.find(id), names: () => customCommands.list().map((c) => c.name), save: ({ id, ...rest }) => customCommands.save({ ...(rest as unknown as Parameters<typeof customCommands.save>[0]), id: id ? (customCommands.find(id)?.id ?? null) : null }), next: (name, n) => `${name}-${n}` }),
  group: 'Tools',
  kind: 'command',
  label: 'Command',
  plural: 'Commands',
  exportable: true,
  icon: 'terminal',
  description: 'slash commands the user can type in a chat, like /help',
  parts: [],
  actions: [],
  available: () => true,
  remove(id) {
    const c = customCommands.find(id)
    if (!c) throw new ToolError(`/${id} is built in and can't be deleted`)
    customCommands.delete(c.id)
  },
  rename(id, name) {
    if (!customCommands.find(id)) throw new ToolError(`/${id} is built in and can't be renamed`)
    customCommands.rename(id, name)
  },
  title: (id) => `/${id}`,
  search(query, limit, ctx) {
    const q = query.toLowerCase().replace(/^\//, '')
    return commandsFor({ sessionId: null, agentId: ctx.agentId ?? '' })
      .filter((c) => !q || has(c.name, q) || has(c.summary, q))
      .slice(0, limit)
      .map((c) => ({ kind: 'command', id: c.name, title: `/${c.name}` }))
  },
  resolve: (ref, ctx) => findCommand(commandsFor({ sessionId: null, agentId: ctx.agentId ?? '' }), ref)?.name ?? null,
  line: (id, ctx) => findCommand(commandsFor({ sessionId: null, agentId: ctx.agentId ?? '' }), id)?.summary ?? '',
  card(id, ctx) {
    return this.full(id, {}, ctx)
  },
  full(id, _options, ctx) {
    const c = findCommand(commandsFor({ sessionId: null, agentId: ctx.agentId ?? '' }), id)
    if (!c) throw new ToolError(`No command /${id}`)
    return c.usage
  }
}

registerKind(200, skillKind)
registerKind(230, agentKind)
registerKind(260, memoryKind)
registerKind(270, thoughtKind)
registerKind(280, styleKind)
registerKind(320, commandKind)
