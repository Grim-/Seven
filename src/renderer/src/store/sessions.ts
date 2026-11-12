import { create } from 'zustand'
import type { AssetMeta, ChatMessage, ChatPart, ContextSummary, ContextUsage, PermissionMode, SessionMeta, ThinkingLevel, ToolChoiceMode, TodoItem, TodoList, ToolPart } from '@shared/types'
import { engine } from '../lib/ipc'
import { DEFAULT_AGENT_ID } from './agents'
import { importPaths } from '../lib/importFiles'
import type { Conversation } from '../lib/conversation'

const PENDING_ID = '__pending__'
const fresh = new Set<string>()
const NO_FILES: AssetMeta[] = []

export interface ChatDraft {
  agentId: string
  style: string | null
  thinking: ThinkingLevel | null
  toolChoice: ToolChoiceMode | null
  files: AssetMeta[]
  usage: ContextUsage | null
}

interface SessionsState {
  list: SessionMeta[]
  drafts: Record<string, ChatDraft>
  defaultAgentId: string
  messages: Record<string, ChatMessage[]>
  running: Record<string, boolean>
  stopping: Record<string, boolean>
  pendingUi: Record<string, string>
  outputs: Record<string, string>
  usage: Record<string, ContextUsage | null>
  instructionsChanged: Record<string, boolean>
  setDraftStyle: (key: string, style: string | null) => void
  setDraftThinking: (key: string, thinking: ThinkingLevel | null) => void
  setDraftToolChoice: (key: string, toolChoice: ToolChoiceMode | null) => void
  attach: (key: string, paths: string[]) => Promise<void>
  detach: (key: string, id: string) => void
  summaries: Record<string, ContextSummary[]>
  todos: Record<string, TodoList | null>
  setTodos: (sessionId: string, items: TodoItem[]) => Promise<void>
  compacting: Record<string, boolean>
  compact: (sessionId: string) => Promise<void>
  onCompacting: (sessionId: string, active: boolean) => void
  recheckContext: (conv: Conversation) => Promise<void>
  onUsage: (sessionId: string, usage: ContextUsage) => void
  checkContext: (sessionId: string) => Promise<void>
  refreshInstructions: (sessionId: string) => Promise<void>
  setList: (list: SessionMeta[]) => void
  refresh: (open?: string[]) => Promise<void>
  load: (id: string) => Promise<void>
  startNew: (conv: Conversation, agentId?: string) => void
  setDraftAgent: (key: string, agentId: string) => void
  ensureSession: (conv: Conversation) => Promise<string>
  send: (conv: Conversation, text: string) => Promise<string>
  abort: (sessionId: string) => Promise<void>
  rename: (id: string, title: string) => Promise<void>
  remove: (id: string) => Promise<void>
  onTurnStart: (sessionId: string, user: ChatMessage, assistant: ChatMessage) => void
  onDelta: (sessionId: string, messageId: string, type: 'text' | 'thought', text: string) => void
  onPart: (sessionId: string, messageId: string, part: ToolPart) => void
  onOutput: (partId: string, chunk: string) => void
  setMode: (id: string, mode: PermissionMode | null) => Promise<void>
  onTurnFinish: (sessionId: string, message: ChatMessage) => void
}

function appendText(parts: ChatPart[], type: 'text' | 'thought', text: string): ChatPart[] {
  const last = parts[parts.length - 1]
  if (last && last.type === type) return [...parts.slice(0, -1), { type, text: last.text + text }]
  return [...parts, { type, text }]
}

function upsertPart(parts: ChatPart[], part: ToolPart): ChatPart[] {
  const index = parts.findIndex((p) => p.type === 'tool' && p.id === part.id)
  if (index === -1) return [...parts, part]
  return parts.map((p, i) => (i === index ? part : p))
}

function pendingFrom(sessionId: string, messages: ChatMessage[], current: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = {}
  for (const [id, sid] of Object.entries(current)) if (sid !== sessionId) next[id] = sid
  for (const m of messages)
    for (const p of m.parts) if (p.type === 'tool' && p.ui?.status === 'pending') next[p.ui.id] = sessionId
  return next
}

export function draftOf(s: Pick<SessionsState, 'drafts' | 'defaultAgentId'>, key: string): ChatDraft {
  return s.drafts[key] ?? { agentId: s.defaultAgentId, style: null, thinking: null, toolChoice: null, files: NO_FILES, usage: null }
}

export const useSessions = create<SessionsState>((set, get) => {
  const patchDraft = (key: string, patch: Partial<ChatDraft>) => set((s) => ({ drafts: { ...s.drafts, [key]: { ...draftOf(s, key), ...patch } } }))
  return {
  list: [],
  drafts: {},
  defaultAgentId: DEFAULT_AGENT_ID,
  messages: {},
  running: {},
  stopping: {},
  pendingUi: {},
  outputs: {},
  usage: {},
  instructionsChanged: {},
  setDraftStyle: (key, style) => patchDraft(key, { style }),
  setDraftThinking: (key, thinking) => patchDraft(key, { thinking }),
  setDraftToolChoice: (key, toolChoice) => patchDraft(key, { toolChoice }),

  attach: async (key, paths) => {
    if (!paths.length) return
    const added = await importPaths(paths)
    const files = draftOf(get(), key).files
    patchDraft(key, { files: [...files, ...added.filter((a) => !files.some((d) => d.id === a.id))] })
  },

  detach: (key, id) => patchDraft(key, { files: draftOf(get(), key).files.filter((f) => f.id !== id) }),
  summaries: {},
  todos: {},
  setTodos: async (sessionId, items) => {
    set((s) => ({ todos: { ...s.todos, [sessionId]: { items, updatedAt: Date.now(), editedByUser: true } } }))
    await engine('todos.set', { sessionId, items })
  },
  compacting: {},

  compact: async (sessionId) => {
    await engine('sessions.compact', { id: sessionId })
  },

  onCompacting: (sessionId, active) => set((s) => ({ compacting: { ...s.compacting, [sessionId]: active } })),

  recheckContext: async (conv) => {
    if (conv.sessionId) return get().checkContext(conv.sessionId)
    const agentId = draftOf(get(), conv.key).agentId
    const usage = await engine('agents.contextUsage', { agentId }).catch(() => null)
    if (draftOf(get(), conv.key).agentId === agentId) patchDraft(conv.key, { usage })
  },

  onUsage: (sessionId, usage) => set((s) => ({ usage: { ...s.usage, [sessionId]: usage } })),

  checkContext: async (sessionId) => {
    const ctx = await engine('sessions.context', { id: sessionId }).catch(() => null)
    if (!ctx) return
    set((s) => ({ usage: { ...s.usage, [sessionId]: ctx.usage }, instructionsChanged: { ...s.instructionsChanged, [sessionId]: ctx.instructionsChanged } }))
  },

  refreshInstructions: async (sessionId) => {
    await engine('sessions.refreshInstructions', { id: sessionId })
    await get().checkContext(sessionId)
  },

  setList: (list) => set({ list }),

  refresh: async (open = []) => {
    const list = await engine('sessions.list')
    set({ list })
    await Promise.all(open.filter((id) => list.some((s) => s.id === id)).map((id) => get().load(id)))
  },

  load: async (id) => {
    if (fresh.delete(id)) return
    const snapshot = await engine('sessions.open', { id })
    set((s) => ({
      messages: { ...s.messages, [id]: snapshot.messages },
      running: { ...s.running, [id]: snapshot.running },
      pendingUi: pendingFrom(id, snapshot.messages, s.pendingUi),
      usage: { ...s.usage, [id]: snapshot.usage },
      instructionsChanged: { ...s.instructionsChanged, [id]: snapshot.instructionsChanged },
      summaries: { ...s.summaries, [id]: snapshot.summaries },
      compacting: { ...s.compacting, [id]: snapshot.compacting },
      todos: { ...s.todos, [id]: snapshot.todos }
    }))
  },

  startNew: (conv, agentId) => {
    patchDraft(conv.key, { agentId: agentId ?? draftOf(get(), conv.key).agentId, style: null, thinking: null })
    if (agentId) set({ defaultAgentId: agentId })
    conv.go(null)
    void get().recheckContext({ ...conv, sessionId: null })
  },

  setDraftAgent: (key, agentId) => {
    patchDraft(key, { agentId })
    set({ defaultAgentId: agentId })
    void get().recheckContext({ key, sessionId: null, go: () => undefined })
  },

  ensureSession: async (conv) => {
    if (conv.sessionId) return conv.sessionId
    const draft = draftOf(get(), conv.key)
    const created = await engine('sessions.create', { agentId: draft.agentId })
    const meta = { ...created, ...(draft.style ? { reasoningStyle: draft.style } : {}), ...(draft.thinking ? { thinking: draft.thinking } : {}), ...(draft.toolChoice ? { toolChoice: draft.toolChoice } : {}) }
    if (draft.style) await engine('sessions.setStyle', { id: meta.id, style: draft.style }).catch(() => undefined)
    if (draft.thinking) await engine('sessions.setThinking', { id: meta.id, thinking: draft.thinking }).catch(() => undefined)
    if (draft.toolChoice) await engine('sessions.setToolChoice', { id: meta.id, toolChoice: draft.toolChoice }).catch(() => undefined)
    patchDraft(conv.key, { style: null, thinking: null, toolChoice: null })
    fresh.add(meta.id)
    set((s) => ({ list: [meta, ...s.list.filter((x) => x.id !== meta.id)], messages: { ...s.messages, [meta.id]: [] } }))
    conv.go(meta.id)
    return meta.id
  },

  send: async (conv, text) => {
    const files = draftOf(get(), conv.key).files
    const sessionId = await get().ensureSession(conv)
    const attachments = files.map((f) => f.id)
    const pending: ChatMessage = {
      id: PENDING_ID,
      role: 'user',
      parts: [{ type: 'text', text }],
      createdAt: Date.now(),
      status: 'complete',
      ...(attachments.length ? { attachments } : {})
    }
    patchDraft(conv.key, { files: [] })
    set((s) => ({
      messages: { ...s.messages, [sessionId]: [...(s.messages[sessionId] ?? []), pending] },
      running: { ...s.running, [sessionId]: true }
    }))
    try {
      await engine('sessions.send', { id: sessionId, text, attachments })
    } catch (err) {
      patchDraft(conv.key, { files })
      set((s) => ({
        messages: { ...s.messages, [sessionId]: (s.messages[sessionId] ?? []).filter((m) => m.id !== PENDING_ID) },
        running: { ...s.running, [sessionId]: false }
      }))
      throw err
    }
    return sessionId
  },

  abort: async (id) => {
    set((s) => ({ stopping: { ...s.stopping, [id]: true } }))
    await engine('sessions.abort', { id })
  },

  rename: async (id, title) => {
    await engine('sessions.rename', { id, title })
  },

  remove: async (id) => {
    await engine('sessions.delete', { id })
    set((s) => {
      const messages = { ...s.messages }
      delete messages[id]
      return { messages }
    })
  },

  onTurnStart: (sessionId, user, assistant) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [sessionId]: [...(s.messages[sessionId] ?? []).filter((m) => m.id !== PENDING_ID), user, assistant]
      },
      running: { ...s.running, [sessionId]: true },
      stopping: { ...s.stopping, [sessionId]: false }
    })),

  onDelta: (sessionId, messageId, type, text) =>
    set((s) => {
      const list = s.messages[sessionId]
      if (!list) return s
      return {
        messages: {
          ...s.messages,
          [sessionId]: list.map((m) => (m.id === messageId ? { ...m, parts: appendText(m.parts, type, text) } : m))
        }
      }
    }),

  onOutput: (partId, chunk) =>
    set((s) => {
      const current = s.outputs[partId] ?? ''
      const next = current.length > 60000 ? current.slice(-50000) + chunk : current + chunk
      return { outputs: { ...s.outputs, [partId]: next } }
    }),

  setMode: async (id, mode) => {
    await engine('sessions.setMode', { id, mode })
  },

  onPart: (sessionId, messageId, part) =>
    set((s) => {
      const pendingUi = { ...s.pendingUi }
      const outputs = part.status === 'running' ? s.outputs : { ...s.outputs }
      if (part.status !== 'running') delete outputs[part.id]
      if (part.ui?.status === 'pending') pendingUi[part.ui.id] = sessionId
      else if (part.ui) delete pendingUi[part.ui.id]
      const list = s.messages[sessionId]
      if (!list) return { pendingUi, outputs }
      return {
        pendingUi,
        outputs,
        messages: {
          ...s.messages,
          [sessionId]: list.map((m) => (m.id === messageId ? { ...m, parts: upsertPart(m.parts, part) } : m))
        }
      }
    }),

  onTurnFinish: (sessionId, message) =>
    set((s) => {
      const list = s.messages[sessionId] ?? []
      const exists = list.some((m) => m.id === message.id)
      const pendingUi = { ...s.pendingUi }
      for (const [id, sid] of Object.entries(pendingUi)) if (sid === sessionId) delete pendingUi[id]
      return {
        pendingUi,
        messages: { ...s.messages, [sessionId]: exists ? list.map((m) => (m.id === message.id ? message : m)) : [...list, message] },
        running: { ...s.running, [sessionId]: false }
      }
    })
  }
})
