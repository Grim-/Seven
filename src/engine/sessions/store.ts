import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import type { ChatHistoryItem } from '../chat/items'
import { PERMISSION_MODES, type ChatMessage, type ContextSummary, type ContextUsage, type PermissionMode, type SessionMeta, type TodoItem, type TodoList } from '@shared/types'
import { paths } from '../util/paths'
import { copyPath, newId, readJson, removePath, writeJson } from '../util/fs'
import { MemoryFiles, diskFiles, type SessionFiles } from './files'
import { isValidHistory } from '../chat/history'
import { isVaultLocked } from '@shared/sealed'
import { timeline } from '../timeline/store'

function cleanMode(input: unknown): PermissionMode | null {
  return PERMISSION_MODES.some((m) => m.id === input) ? (input as PermissionMode) : null
}

type SessionEvent = { type: 'message'; message: ChatMessage }

type TurnModel = { id: string; items: ChatHistoryItem[] }

export interface FrozenInstructions {
  systemPrompt: string
  tools: string[]
  workspace: string | null
  builtAt: number
  memory?: string
  acceptedMemory?: string
}

export interface SessionContext {
  instructions: FrozenInstructions | null
  usage: ContextUsage | null
  summaries: ContextSummary[]
}

const INCOGNITO_OUTPUTS = path.join(os.tmpdir(), 'seven-incognito')

export class SessionStore extends EventEmitter {
  private metas = new Map<string, SessionMeta>()
  private memory = new Map<string, MemoryFiles>()
  private incognitoAgent: (agentId: string) => boolean = () => false

  constructor() {
    super()
    this.reload()
  }

  reload(): void {
    for (const id of [...this.metas.keys()]) if (!this.memory.has(id)) this.metas.delete(id)
    fs.mkdirSync(paths.sessions, { recursive: true })
    for (const entry of fs.readdirSync(paths.sessions, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      let meta: SessionMeta | null
      try {
        meta = readJson<SessionMeta | null>(path.join(paths.sessions, entry.name, 'meta.json'), null)
      } catch (err) {
        if (isVaultLocked(err)) continue
        throw err
      }
      if (meta?.id) this.metas.set(meta.id, { ...meta, permissionMode: cleanMode(meta.permissionMode) })
    }
    this.changed()
  }

  useIncognito(fn: (agentId: string) => boolean): void {
    this.incognitoAgent = fn
    removePath(INCOGNITO_OUTPUTS)
  }

  isIncognito(id: string | null): boolean {
    return id !== null && this.memory.has(id)
  }

  private dir(id: string): string {
    return path.join(paths.sessions, id)
  }

  files(id: string): SessionFiles {
    return this.memory.get(id) ?? diskFiles(this.dir(id))
  }

  private writeMeta(meta: SessionMeta): void {
    this.metas.set(meta.id, meta)
    if (!meta.incognito) writeJson(path.join(this.dir(meta.id), 'meta.json'), meta)
  }

  private open(meta: SessionMeta): void {
    if (meta.incognito) this.memory.set(meta.id, new MemoryFiles())
    this.writeMeta(meta)
  }

  private changed(): void {
    this.emit('changed', this.list())
  }

  list(): SessionMeta[] {
    return [...this.metas.values()].sort((a, b) => b.updatedAt - a.updatedAt)
  }

  get(id: string): SessionMeta {
    const meta = this.metas.get(id)
    if (!meta) throw new Error('That chat no longer exists. Open another chat, or start a new one.')
    return meta
  }

  create(agentId: string): SessionMeta {
    const now = Date.now()
    const meta: SessionMeta = { id: newId('s'), title: 'New chat', agentId, permissionMode: null, ...(this.incognitoAgent(agentId) ? { incognito: true } : {}), createdAt: now, updatedAt: now }
    this.open(meta)
    this.changed()
    return meta
  }

  update(id: string, patch: Partial<Pick<SessionMeta, 'title' | 'agentId' | 'permissionMode' | 'reasoningStyle' | 'thinking' | 'toolChoice' | 'probe'>>): SessionMeta {
    const current = this.get(id)
    if (patch.agentId && patch.agentId !== current.agentId && this.incognitoAgent(patch.agentId) !== (current.incognito === true)) throw new Error(current.incognito ? 'This is an incognito chat. Start a new chat to talk to an agent that is not incognito.' : 'That agent is incognito. Start a new chat with it instead.')
    const meta = { ...current, ...patch, updatedAt: Date.now() }
    this.writeMeta(meta)
    this.changed()
    return meta
  }

  fork(id: string, messages: ChatMessage[], context: SessionContext): SessionMeta {
    const source = this.get(id)
    const now = Date.now()
    const meta: SessionMeta = {
      id: newId('s'),
      title: `${source.title} (fork)`,
      agentId: source.agentId,
      permissionMode: source.permissionMode,
      ...(source.reasoningStyle !== undefined ? { reasoningStyle: source.reasoningStyle } : {}),
      ...(source.thinking ? { thinking: source.thinking } : {}),
      ...(source.probe ? { probe: source.probe } : {}),
      ...(source.incognito ? { incognito: true } : {}),
      createdAt: now,
      updatedAt: now
    }
    const keep = new Set(messages.map((m) => m.id))
    const models = this.files(id).readLines<TurnModel>('model.jsonl').filter((m) => keep.has(m.id))
    this.open(meta)
    const to = this.files(meta.id)
    to.writeLines('events.jsonl', messages.map((message) => ({ type: 'message', message }) satisfies SessionEvent))
    if (models.length) to.writeLines('model.jsonl', models)
    to.writeJson('context.json', context)
    copyPath(this.outputsDir(id), this.outputsDir(meta.id))
    this.changed()
    return meta
  }

  delete(id: string): boolean {
    if (!this.metas.delete(id)) return false
    removePath(this.outputsDir(id))
    if (!this.memory.delete(id)) removePath(this.dir(id))
    timeline.forget('chat', id)
    timeline.clearChatContext(id)
    this.changed()
    return true
  }

  messages(id: string): ChatMessage[] {
    const latest = new Map<string, ChatMessage>()
    for (const event of this.files(id).readLines<SessionEvent>('events.jsonl')) {
      if (event.type !== 'message') continue
      latest.delete(event.message.id)
      latest.set(event.message.id, event.message)
    }
    return [...latest.values()].sort((a, b) => a.createdAt - b.createdAt)
  }

  appendMessage(id: string, message: ChatMessage): void {
    this.files(id).appendLine('events.jsonl', { type: 'message', message } satisfies SessionEvent)
  }

  truncate(id: string, keep: Set<string>): void {
    const files = this.files(id)
    files.writeLines('events.jsonl', files.readLines<SessionEvent>('events.jsonl').filter((e) => e.type !== 'message' || keep.has(e.message.id)))
    if (files.exists('model.jsonl')) files.writeLines('model.jsonl', files.readLines<TurnModel>('model.jsonl').filter((m) => keep.has(m.id)))
  }

  saveTurnModel(id: string, messageId: string, items: ChatHistoryItem[]): void {
    this.files(id).appendLine('model.jsonl', { id: messageId, items } satisfies TurnModel)
  }

  turnModels(id: string): Map<string, ChatHistoryItem[]> {
    const out = new Map<string, ChatHistoryItem[]>()
    for (const entry of this.files(id).readLines<TurnModel>('model.jsonl')) if (entry?.id && Array.isArray(entry.items)) out.set(entry.id, entry.items)
    return out
  }

  loadContext(id: string): SessionContext {
    const saved = this.files(id).readJson<Partial<SessionContext> | null>('context.json', null)
    return { instructions: saved?.instructions ?? null, usage: saved?.usage ?? null, summaries: Array.isArray(saved?.summaries) ? saved.summaries : [] }
  }

  saveContext(id: string, patch: Partial<SessionContext>): SessionContext {
    const next = { ...this.loadContext(id), ...patch }
    this.files(id).writeJson('context.json', next)
    return next
  }

  outputsDir(id: string): string {
    return this.memory.has(id) ? path.join(INCOGNITO_OUTPUTS, id) : path.join(this.dir(id), 'outputs')
  }

  clearHistory(id: string): void {
    this.files(id).remove('history.json')
  }

  loadHistory(id: string): ChatHistoryItem[] | null {
    const value = this.files(id).readJson<unknown>('history.json', null)
    return isValidHistory(value) ? value : null
  }

  stateFile(id: string): string | null {
    return this.memory.has(id) ? null : path.join(this.dir(id), 'state.bin')
  }

  pruneStates(keep: number): void {
    const files = [...this.metas.keys()]
      .map((id) => this.stateFile(id))
      .filter((f): f is string => f !== null && fs.existsSync(f))
      .map((f) => ({ f, at: fs.statSync(f).mtimeMs }))
      .sort((x, y) => y.at - x.at)
    for (const { f } of files.slice(keep)) {
      removePath(f)
      removePath(`${f}.json`)
    }
  }

  todos(id: string): TodoList | null {
    const saved = this.files(id).readJson<TodoList | null>('todos.json', null)
    return saved && Array.isArray(saved.items) ? saved : null
  }

  setTodos(id: string, items: TodoItem[], byUser: boolean): TodoList {
    const list: TodoList = { items, updatedAt: Date.now(), editedByUser: byUser }
    this.files(id).writeJson('todos.json', list)
    this.emit('todos', id, list)
    return list
  }

  clearTodoEdit(id: string): void {
    const list = this.todos(id)
    if (list?.editedByUser) this.files(id).writeJson('todos.json', { ...list, editedByUser: false })
  }

  saveHistory(id: string, history: ChatHistoryItem[]): void {
    this.files(id).writeJson('history.json', history)
  }
}
