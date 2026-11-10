import { EventEmitter } from 'node:events'
import crypto from 'node:crypto'
import type { ChatHistoryItem } from './items'
import path from 'node:path'
import type { AgentDraft, AgentProfile, ModelConfig, ThinkingLevel, ChatMessage, ChatPart, ContextSummary, ContextUsage, PermissionMode, PromptCost, PromptView, TurnPhaseKind, RewindPreview, SessionMeta, ToolPart } from '@shared/types'
import type { Events } from '@shared/protocol'
import type { ModelHost } from '../model/host'
import { checkFits } from './fit'
import { buildInstructions, withState } from './context'
import { TurnMeter, usageOf } from './stats'
import { NEXT_TURN, activeSummary, rebuildHistory, summaryBlock, type FitResult } from './history'
import { TOOLS_OFF, applyTrim, handoffRequest, planSummary, planTrim, summaryRequest } from './compact'
import { data } from '../data/hub'
import { contextPrefs } from './prefs'
import { ChatBusy } from './busy'
import { ApiChat } from '../model/apiChat'
import type { ModelRegistry } from '../model/registry'
import type { AgentRegistry } from '../agents/registry'
import type { SessionStore } from '../sessions/store'
import type { UiRequests } from '../ui/requests'
import type { ToolDef } from '../tools/types'
import type { PermissionStore } from '../permissions/rules'
import type { CheckpointStore } from '../checkpoints/store'
import { newGrants, type SessionGrants } from '../permissions/gate'
import { detectShell } from '../tools/shell'
import { promptOptions, serverSampling, thinkingLevel, withThinking } from '../model/params'
import { findTool, toolsFor } from '../tools/registry'
import { USER, referenceText, resolveEntry } from '../library/kinds'
import { referencePattern } from '@shared/text'

const ACTIVITY_KEYS = ['command', 'path', 'pattern', 'query', 'url', 'title', 'collection', 'name', 'board']

function activityOf(name: string, args: Record<string, unknown>): string | null {
  const custom = findTool(name)?.activity
  if (custom) {
    try {
      return custom(args)
    } catch {
      return null
    }
  }
  const value = ACTIVITY_KEYS.map((k) => args[k]).find((v) => typeof v === 'string' && v.trim())
  return typeof value === 'string' ? (value.length > 80 ? `${value.slice(0, 77)}...` : value) : null
}
import { buildFunctions, runTool, type WrapHooks } from '../tools/wrap'
import { newId, readText, writeText } from '../util/fs'
import { secure } from '../util/secure'
import { minds } from '../mind/store'
import { mindAuto, recallBlock } from '../mind/auto'
import { CHECK_IN, checkInText } from './checkin'
import { probeBrief, probeInstructions, probePageTitle, probeState, probeTools } from '../probe/probe'
import { DEFAULT_REMIND_EVERY } from '../agents/registry'
import { renderTodos } from '../sessions/access'
import { makeTitle } from './title'
import { recordTurn } from '../turnstats'
import { linkedFolders } from '../folders/store'
import { modules } from '../modules/registry'
import { estimateTokens, fitToBudget, type OutputBudget } from '../tools/budget'
import { LIMITS } from '../limits'
import { board } from '../board/store'
import { timeline } from '../timeline/store'

type Emit = <K extends keyof Events>(event: K, payload: Events[K]) => void

interface ActiveChat {
  sessionId: string
  modelId: string
  systemPrompt: string
  chat: ApiChat
}

interface Turn {
  sessionId: string
  prompt: string
  modelPrompt: string
  agent: AgentProfile
  controller: AbortController
  phaseKey?: string
  message: ChatMessage
  userMessageId: string
  blocks: number
  stopReason: string | null
  lastCall: { key: string; count: number } | null
  struggle?: { tool: string; count: number } | null
  stoppedTools?: Set<string>
  systemPrompt?: string
  meter?: TurnMeter
  usageBase?: { fixed: number; before: number; size: number }
  historyIndex?: number
  images?: string[]
  pendingImages?: string[]
}

const MAX_BLOCKS_PER_TURN = 3

const INTERRUPTED = 'Interrupted: Seven stopped before this reply finished.'

function appendText(parts: ChatPart[], type: 'text' | 'thought', text: string): void {
  if (!text) return
  const last = parts[parts.length - 1]
  if (last && last.type === type) last.text += text
  else parts.push({ type, text })
}

function withSystemPrompt(history: ChatHistoryItem[], systemPrompt: string): ChatHistoryItem[] {
  const rest = history.filter((item) => item.type !== 'system')
  return systemPrompt ? [{ type: 'system', text: systemPrompt }, ...rest] : rest
}

function copy(message: ChatMessage): ChatMessage {
  return {
    ...message,
    parts: message.parts.map((p) => (p.type === 'tool' ? { ...p, ui: p.ui ? { ...p.ui } : undefined } : { ...p }))
  }
}

function interrupt(message: ChatMessage): ChatMessage {
  return {
    ...message,
    status: 'error',
    error: INTERRUPTED,
    parts: message.parts.map((p) =>
      p.type === 'tool' && p.status === 'running'
        ? { ...p, status: 'error', error: 'Interrupted', ui: p.ui && p.ui.status === 'pending' ? { ...p.ui, status: 'expired' } : p.ui }
        : p
    )
  }
}

function linkImages(prompt: string): string[] {
  const out: string[] = []
  for (const m of prompt.matchAll(referencePattern())) {
    try {
      const hit = resolveEntry(m[3].replace(/^"|"$/g, ''), m[2], USER)
      const asset = hit.kind.asset?.(hit.id) ?? null
      if (asset?.kind === 'image' && !out.includes(asset.id)) out.push(asset.id)
    } catch {
      continue
    }
  }
  return out
}

function userImages(message: ChatMessage): string[] {
  const text = message.parts.map((p) => (p.type === 'text' ? p.text : '')).join('')
  const attached = (message.attachments ?? []).filter((id) => data.assets.metaFor(id)?.kind === 'image')
  return [...new Set([...attached, ...linkImages(text)])]
}

function referenceBlock(prompt: string): string {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const m of prompt.matchAll(referencePattern())) {
    const ref = m[3].replace(/^"|"$/g, '')
    const part = m[4]?.toLowerCase() ?? null
    if (part === 'random') continue
    const key = `${m[2].toLowerCase()}:${ref}#${part ?? ''}`
    if (seen.has(key) || seen.size >= 8) continue
    seen.add(key)
    const tag = `@${m[2]}:${ref}${part ? `#${part}` : ''}`
    let found: ReturnType<typeof referenceText> = null
    let problem = 'Not found.'
    try {
      found = referenceText(m[2], ref, part)
    } catch (err) {
      problem = err instanceof Error ? err.message : String(err)
    }
    parts.push(found ? `### ${tag} (${found.label}: ${found.title})\n${found.text}` : `### ${tag}\n(${problem})`)
  }
  return parts.length ? `\n\n[The user referenced these:]\n${parts.join('\n\n')}` : ''
}

export class ChatRunner extends EventEmitter {
  private active: ActiveChat | null = null
  private turn: Turn | null = null
  private compacting: { sessionId: string; controller: AbortController } | null = null
  private preparing = false

  get busy(): boolean {
    return this.preparing || this.turn !== null || this.compacting !== null
  }
  private grants = new Map<string, SessionGrants>()

  constructor(
    private host: ModelHost,
    private models: ModelRegistry,
    private agents: AgentRegistry,
    private sessions: SessionStore,
    private requests: UiRequests,
    private permissions: PermissionStore,
    private checkpoints: CheckpointStore,
    private emitEvent: Emit
  ) {
    super()
    host.on('unloading', () => this.closeActive())
    minds.on('pinned', (sessionId: string) => this.remembered(sessionId))
  }

  isRunning(sessionId: string): boolean {
    return this.turn?.sessionId === sessionId
  }

  isCompacting(sessionId: string): boolean {
    return this.compacting?.sessionId === sessionId
  }

  private assertIdle(sessionId: string): void {
    if (this.compacting) throw new ChatBusy(this.compacting.sessionId === sessionId ? 'This chat is being summarised. Wait for the summary to finish, then try again.' : 'Another chat is being summarised. Wait for it to finish, then try again.')
    if (this.turn) throw new ChatBusy(this.turn.sessionId === sessionId ? 'A reply is still being written in this chat. Wait for it to finish or stop it, then try again.' : 'A reply is still being written in another chat. Wait for it to finish or stop it, then try again.')
  }

  summaries(sessionId: string): ContextSummary[] {
    return this.sessions.loadContext(sessionId).summaries
  }

  private fitFor(sessionId: string): FitResult {
    const agent = this.agents.getOrDefault(this.sessions.get(sessionId).agentId)
    const budget = this.budgetFor(sessionId, agent)
    return (part, text) => {
      try {
        return fitToBudget(part.id, text, budget).text
      } catch {
        return text
      }
    }
  }

  editReply(sessionId: string, messageId: string, edits: { index: number; text: string }[]): ChatMessage {
    this.assertIdle(sessionId)
    const message = this.sessions.messages(sessionId).find((m) => m.id === messageId)
    if (!message || message.role !== 'assistant') throw new Error('That reply is no longer in this chat')
    if (message.status === 'running') throw new ChatBusy('A reply is still being written in this chat. Wait for it to finish or stop it, then try again.')
    const drop = new Set<number>()
    for (const { index, text } of edits) {
      const part = message.parts[index]
      if (!part) throw new Error('The reply changed while you were editing it')
      if (part.type === 'text') {
        if (text.trim()) part.text = text
        else drop.add(index)
      } else if (part.type === 'tool') {
        if (part.status !== 'done') continue
        part.result = text
        part.edited = true
        if (part.view?.kind === 'thought' && part.view.data && typeof part.view.data === 'object') part.view = { ...part.view, data: { ...(part.view.data as object), conclusion: text } }
      }
    }
    message.parts = message.parts.filter((_p, i) => !drop.has(i))
    message.edited = true
    this.sessions.appendMessage(sessionId, message)
    const agent = this.agents.getOrDefault(this.sessions.get(sessionId).agentId)
    const { systemPrompt } = this.instructionsFor(sessionId, agent)
    this.applyHistory(sessionId, this.rebuildFor(sessionId, systemPrompt))
    this.emitEvent('session.rewritten', { sessionId })
    return message
  }

  editResult(sessionId: string, messageId: string, partId: string, text: string): ToolPart {
    this.assertIdle(sessionId)
    const message = this.sessions.messages(sessionId).find((m) => m.id === messageId)
    const part = message?.parts.find((p): p is ToolPart => p.type === 'tool' && p.id === partId)
    if (!message || !part) throw new Error('That tool call is no longer in this chat')
    if (part.status !== 'done') throw new Error('This tool call did not finish, so it has no result to edit. Only finished tool calls can be edited.')
    part.result = text
    part.edited = true
    const data = part.view?.kind === 'thought' && part.view.data && typeof part.view.data === 'object' ? (part.view.data as { id?: unknown }) : null
    if (part.view && data) part.view = { ...part.view, data: { ...data, conclusion: text } }
    this.sessions.appendMessage(sessionId, message)
    const agent = this.agents.getOrDefault(this.sessions.get(sessionId).agentId)
    if (data && typeof data.id === 'string') minds.setConclusion(agent.id, data.id, text)
    const { systemPrompt } = this.instructionsFor(sessionId, agent)
    this.applyHistory(sessionId, this.rebuildFor(sessionId, systemPrompt))
    this.emitEvent('message.part', { sessionId, messageId, part: { ...part } })
    return part
  }

  private rebuildFor(sessionId: string, systemPrompt: string): ChatHistoryItem[] {
    const messages = this.sessions.messages(sessionId)
    return rebuildHistory({
      systemPrompt,
      messages,
      slices: this.sessions.turnModels(sessionId),
      summary: activeSummary(this.sessions.loadContext(sessionId).summaries, messages),
      fit: this.fitFor(sessionId),
      imagesOf: userImages
    })
  }

  private applyHistory(sessionId: string, history: ChatHistoryItem[]): void {
    this.sessions.saveHistory(sessionId, history)
    if (this.active?.sessionId === sessionId && !this.active.chat.disposed) this.active.chat.setChatHistory(history)
  }

  private count(text: string): number {
    return estimateTokens(text)
  }

  private remoteModel(agent: AgentProfile): boolean {
    return this.models.isRemote(agent.modelId)
  }

  private sizeFor(agent: AgentProfile): number | null {
    if (agent.modelId && this.models.isRemote(agent.modelId)) return this.models.remoteTarget(agent.modelId).contextSize
    return this.host.contextSize
  }

  snapshot(sessionId: string): ChatMessage[] {
    const live = this.turn?.sessionId === sessionId && this.turn.message.id ? this.turn.message : null
    const stored = this.sessions.messages(sessionId).map((m) => {
      if (live && m.id === live.id) return copy(live)
      return m.status === 'running' ? interrupt(m) : m
    })
    if (live && !stored.some((m) => m.id === live.id)) stored.push(copy(live))
    return stored
  }

  closeActive(): void {
    if (!this.active) return
    if (!this.preparing) this.turn?.controller.abort()
    this.active.chat.dispose()
    this.active = null
  }

  lock(): void {
    this.compacting?.controller.abort()
    this.turn?.controller.abort()
    this.closeActive()
    this.grants.clear()
    if (this.host.loadedId) void this.host.clearContext().catch(() => undefined)
  }

  forget(sessionId: string): void {
    if (this.active?.sessionId === sessionId) this.closeActive()
  }

  private async ensureModel(agent: AgentProfile, sessionId: string | null = null): Promise<string> {
    if (agent.modelId && this.models.isRemote(agent.modelId)) {
      this.models.remoteTarget(agent.modelId)
      return agent.modelId
    }
    const wanted = agent.modelId
    if (wanted && this.host.loadedId !== wanted) {
      if (!this.models.has(wanted)) throw new Error(`${agent.name} is set to a model that is no longer in Models. Pick another model for ${agent.name} in Agents, or add the model back in Models.`)
      await this.host.load(this.models.get(wanted), this.configFor(wanted, agent, sessionId))
    }
    const loaded = this.host.loadedId
    if (!loaded) throw new Error('No model is loaded. Load one in Models, or give this agent a model.')
    const config = this.configFor(loaded, agent, sessionId)
    if (this.host.needsRestart(config)) await this.host.load(this.models.get(loaded), config)
    return loaded
  }

  private stateKey(modelId: string): string {
    return `${modelId}\u0000${this.host.stateKey() ?? ''}`
  }

  private hashHistory(history: ChatHistoryItem[]): string {
    return crypto.createHash('sha1').update(JSON.stringify(history)).digest('hex')
  }

  private async saveState(active: ActiveChat): Promise<void> {
    if (!contextPrefs.get().saveChatState || active.chat.disposed || this.models.isRemote(active.modelId) || this.host.loadedId !== active.modelId) return
    const file = this.sessions.stateFile(active.sessionId)
    if (!file) return
    try {
      await this.host.saveState(file)
      writeText(`${file}.json`, JSON.stringify({ key: this.stateKey(active.modelId), history: this.hashHistory(active.chat.getChatHistory()), savedAt: Date.now() }))
      this.sessions.pruneStates(3)
    } catch (err) {
      this.emitEvent('engine.error', { sessionId: active.sessionId, message: `Could not save the chat's model state: ${err instanceof Error ? err.message : String(err)}` })
    }
  }

  private async loadState(sessionId: string, modelId: string, history: ChatHistoryItem[] | null): Promise<void> {
    if (!contextPrefs.get().saveChatState || !history) return
    const file = this.sessions.stateFile(sessionId)
    if (!file) return
    try {
      const meta = JSON.parse(readText(`${file}.json`)) as { key: string; history: string }
      if (meta.key !== this.stateKey(modelId) || meta.history !== this.hashHistory(history)) return
      await this.host.loadState(file)
    } catch {
      await this.host.clearContext().catch(() => undefined)
    }
  }

  private configFor(modelId: string, agent: AgentProfile, sessionId: string | null = null): ModelConfig {
    let chosen: ThinkingLevel | null = null
    if (sessionId) {
      try {
        chosen = this.sessions.get(sessionId).thinking ?? null
      } catch {
        chosen = null
      }
    }
    return withThinking(this.models.getConfig(modelId), chosen ?? agent.thinking)
  }

  private async ensureChat(sessionId: string, modelId: string, systemPrompt: string): Promise<ApiChat> {
    const a = this.active
    if (a && a.sessionId === sessionId && a.modelId === modelId && a.systemPrompt === systemPrompt && !a.chat.disposed) return a.chat
    if (a && a.sessionId !== sessionId) await this.saveState(a)
    this.closeActive()
    const remoteModel = this.models.isRemote(modelId)
    const chat = new ApiChat(remoteModel ? this.models.remoteTarget(modelId) : this.host.serverTarget(), systemPrompt)
    const saved = this.sessions.loadHistory(sessionId)
    const history = saved ?? (this.sessions.messages(sessionId).length ? this.rebuildFor(sessionId, systemPrompt) : null)
    if (!remoteModel && a?.sessionId !== sessionId) await this.loadState(sessionId, modelId, saved)
    if (history?.length) chat.setChatHistory(withSystemPrompt(history, systemPrompt))
    this.active = { sessionId, modelId, systemPrompt, chat }
    return chat
  }

  private grantsFor(sessionId: string): SessionGrants {
    let grants = this.grants.get(sessionId)
    if (!grants) {
      grants = newGrants()
      this.grants.set(sessionId, grants)
    }
    return grants
  }

  private probeOf(sessionId: string): { subject: string; pageId: string } | null {
    try {
      return this.sessions.get(sessionId).probe ?? null
    } catch {
      return null
    }
  }

  private allowedFor(sessionId: string, agent: AgentProfile): ToolDef[] {
    return this.probeOf(sessionId) ? probeTools() : toolsFor(agent)
  }

  private promptFor(sessionId: string, agent: AgentProfile, tools: ToolDef[], memoryText: string): string {
    const probe = this.probeOf(sessionId)
    if (!probe) return buildInstructions(agent, tools, memoryText)
    return probeInstructions(agent, probe.subject, data.pages.find(probe.pageId)?.title ?? probePageTitle(probe.subject), tools.some((t) => t.name === 'ask_user'))
  }

  private frozenFor(sessionId: string, agent: AgentProfile): { systemPrompt: string; tools: ToolDef[] } | null {
    const allowed = this.allowedFor(sessionId, agent)
    const frozen = this.sessions.loadContext(sessionId).instructions
    const stillAllowed = frozen ? frozen.tools.every((name) => allowed.some((t) => t.name === name)) : false
    if (frozen && stillAllowed && frozen.workspace === agent.workspace) {
      return { systemPrompt: frozen.systemPrompt, tools: allowed.filter((t) => frozen.tools.includes(t.name)) }
    }
    return null
  }

  agentInstructions(agentId: string): string | null {
    const agent = this.agents.list().find((a) => a.id === agentId)
    if (!agent) return null
    return buildInstructions(agent, toolsFor(agent), this.memoryFor(agent))
  }

  instructionsFor(sessionId: string, agent: AgentProfile): { systemPrompt: string; tools: ToolDef[] } {
    return this.frozenFor(sessionId, agent) ?? this.freeze(sessionId, agent, this.allowedFor(sessionId, agent))
  }

  private measure(systemPrompt: string, tools: ToolDef[], history: ChatHistoryItem[], agent: AgentProfile | null = null): ContextUsage | null {
    const size = agent ? this.sizeFor(agent) : this.host.contextSize
    if (!size) return null
    const functions = tools.length ? Object.fromEntries(tools.map((t) => [t.name, { description: t.description, params: t.params }])) : {}
    const fixed = estimateTokens(systemPrompt + JSON.stringify(functions))
    const total = fixed + (history.length ? estimateTokens(JSON.stringify(history.filter((h) => h.type !== 'system'))) : 0)
    return usageOf(total, fixed, total, size)
  }

  usageFor(sessionId: string): ContextUsage | null {
    const saved = this.sessions.loadContext(sessionId).usage
    const agent = this.agents.getOrDefault(this.sessions.get(sessionId).agentId)
    const remote = this.remoteModel(agent)
    if ((!remote && !this.host.isLoaded) || this.turn?.sessionId === sessionId) return saved
    if (saved && saved.size === this.sizeFor(agent)) return saved
    const { systemPrompt, tools } = this.frozenFor(sessionId, agent) ?? (() => {
      const allowed = this.allowedFor(sessionId, agent)
      return { systemPrompt: this.promptFor(sessionId, agent, allowed, this.memoryFor(agent)), tools: allowed }
    })()
    return this.measure(systemPrompt, tools, this.sessions.loadHistory(sessionId) ?? [], agent) ?? saved
  }

  promptView(sessionId: string | null, agentId: string): PromptView {
    const agent = this.agents.getOrDefault(sessionId ? this.sessions.get(sessionId).agentId : agentId)
    const frozen = sessionId ? this.frozenFor(sessionId, agent) : null
    const tools = frozen ? frozen.tools : sessionId ? this.allowedFor(sessionId, agent) : toolsFor(agent)
    const systemPrompt = frozen ? frozen.systemPrompt : sessionId ? this.promptFor(sessionId, agent, tools, this.memoryFor(agent)) : buildInstructions(agent, tools, this.memoryFor(agent))
    const fresh = sessionId && !frozen ? 'This chat has not sent its first message yet, so these are the instructions it will start with. ' : ''
    const functions = Object.fromEntries(tools.map((t) => [t.name, { description: t.description, params: t.params }]))
    const plain = () => `${systemPrompt}${tools.length ? `\n\n----- Tools (${tools.length}) -----\n${JSON.stringify(functions, null, 2)}` : ''}`
    const text = plain()
    return { text, tokens: estimateTokens(text), format: 'API', note: `${fresh}The system message as sent to the model; the tools go alongside it as JSON schemas, and the model's chat template formats both. The token count is an estimate.` }
  }

  draftUsage(agentId: string): ContextUsage | null {
    const agent = this.agents.getOrDefault(agentId)
    const tools = toolsFor(agent)
    return this.measure(buildInstructions(agent, tools, this.memoryFor(agent)), tools, [], agent)
  }

  promptCost(draft: AgentDraft): PromptCost {
    const agent = { ...draft, id: draft.id ?? 'draft' } as AgentProfile
    const tools = toolsFor(agent)
    const systemPrompt = buildInstructions(agent, tools, this.memoryFor(agent))
    const defText = (list: ToolDef[]) => list.map((t) => JSON.stringify({ name: t.name, description: t.description, params: t.params })).join('\n')
    const perModule: Record<string, number> = {}
    for (const group of new Set(modules.tools().map((t) => t.group))) perModule[group] = this.count(defText(modules.tools().filter((t) => t.group === group)))
    const sys = estimateTokens(systemPrompt)
    const defs = tools.length ? estimateTokens(defText(tools)) : 0
    return { exact: false, system: sys, tools: defs, total: sys + defs, contextSize: this.host.contextSize, modules: perModule }
  }

  private memoryFor(agent: AgentProfile): string {
    return mindAuto(agent).pinned ? minds.pinnedForPrompt(agent.id, contextPrefs.get().memoryCap, (t) => this.count(t)) : ''
  }

  private remembered(sessionId: string): void {
    const ctx = this.sessions.loadContext(sessionId)
    if (!ctx.instructions) return
    const agent = this.agents.getOrDefault(this.sessions.get(sessionId).agentId)
    this.sessions.saveContext(sessionId, { instructions: { ...ctx.instructions, acceptedMemory: this.memoryFor(agent) } })
  }

  private freeze(sessionId: string, agent: AgentProfile, tools: ToolDef[]): { systemPrompt: string; tools: ToolDef[] } {
    const memoryText = this.memoryFor(agent)
    const systemPrompt = this.promptFor(sessionId, agent, tools, memoryText)
    this.sessions.saveContext(sessionId, {
      instructions: { systemPrompt, tools: tools.map((t) => t.name), workspace: agent.workspace, builtAt: Date.now(), memory: memoryText },
      usage: null
    })
    return { systemPrompt, tools }
  }

  instructionsChanged(sessionId: string): boolean {
    const frozen = this.sessions.loadContext(sessionId).instructions
    if (!frozen) return false
    const agent = this.agents.getOrDefault(this.sessions.get(sessionId).agentId)
    const allowed = this.allowedFor(sessionId, agent)
    const names = allowed.map((t) => t.name)
    if (names.join(',') !== frozen.tools.join(',') || frozen.workspace !== agent.workspace) return true
    const memoryText = this.memoryFor(agent)
    if (this.promptFor(sessionId, agent, allowed, memoryText) === frozen.systemPrompt) return false
    return !(frozen.acceptedMemory === memoryText && this.promptFor(sessionId, agent, allowed, frozen.memory ?? '') === frozen.systemPrompt)
  }

  refreshInstructions(sessionId: string): boolean {
    if (this.turn?.sessionId === sessionId) throw new ChatBusy('A reply is still being written in this chat. Wait for it to finish or stop it, then try again.')
    const agent = this.agents.getOrDefault(this.sessions.get(sessionId).agentId)
    this.freeze(sessionId, agent, this.allowedFor(sessionId, agent))
    if (this.active?.sessionId === sessionId) this.closeActive()
    return true
  }

  modeFor(sessionId: string): PermissionMode {
    const meta = this.sessions.get(sessionId)
    return meta.permissionMode ?? this.agents.getOrDefault(meta.agentId).permissionMode
  }

  private begin(sessionId: string, prompt: string, agent: AgentProfile, controller: AbortController, historyIndex?: number, attachments: string[] = []): Turn {
    const meta = this.sessions.get(sessionId)
    const now = Date.now()
    const userMessage: ChatMessage = {
      id: newId('m'),
      role: 'user',
      parts: [{ type: 'text', text: prompt }],
      createdAt: now,
      status: 'complete',
      ...(historyIndex !== undefined ? { historyIndex } : {}),
      ...(attachments.length ? { attachments } : {})
    }
    const message: ChatMessage = { id: newId('m'), role: 'assistant', parts: [], createdAt: now + 1, status: 'running' }
    const turn: Turn = { sessionId, prompt, modelPrompt: prompt, agent, controller, message, userMessageId: userMessage.id, blocks: 0, stopReason: null, lastCall: null, historyIndex }
    this.turn = turn
    this.sessions.appendMessage(sessionId, userMessage)
    this.sessions.update(sessionId, meta.title === 'New chat' ? { title: makeTitle(prompt, [agent.name, 'Seven']) } : {})
    this.emitEvent('turn.start', { sessionId, userMessage, assistantMessage: message })
    return turn
  }

  private budgetFor(sessionId: string, agent: AgentProfile): OutputBudget {
    const size = this.sizeFor(agent) ?? this.host.getState().contextSize ?? 8192
    return {
      maxTokens: Math.max(256, Math.floor(size * agent.context.outputShare)),
      count: estimateTokens,
      dir: this.sessions.outputsDir(sessionId),
      room: () => {
        const active = this.active
        if (!active || active.sessionId !== sessionId || active.chat.disposed) return null
        if (this.models.isRemote(active.modelId)) return Math.floor(size * LIMITS.remoteRoomShare)
        return Math.max(0, size - active.chat.used - LIMITS.replyReserveTokens)
      }
    }
  }

  private phase(turn: Turn, kind: TurnPhaseKind, tool: string | null = null, detail: string | null = null): void {
    const key = `${kind}:${tool ?? ''}`
    if (turn.phaseKey === key) return
    turn.phaseKey = key
    turn.meter?.phase(kind)
    this.emitEvent('turn.phase', { sessionId: turn.sessionId, messageId: turn.message.id, phase: { kind, tool, detail, since: Date.now() } })
  }

  private hooks(turn: Turn): WrapHooks {
    const { sessionId, message } = turn
    const emitPart = (part: ToolPart) =>
      this.emitEvent('message.part', { sessionId, messageId: message.id, part: { ...part, ui: part.ui ? { ...part.ui } : undefined } })
    const runner = this
    return {
      sessionId,
      turnId: turn.userMessageId,
      workspace: turn.agent.workspace,
      folders: () => linkedFolders.forAgent(turn.agent.id),
      groups: [...new Set(toolsFor(turn.agent).map((t) => t.group))],
      signal: turn.controller.signal,
      requests: this.requests,
      permissions: {
        get mode() {
          return runner.modeFor(sessionId)
        },
        rules: this.permissions.get(),
        grants: this.grantsFor(sessionId),
        shell: detectShell(),
        blocked: (reason) => {
          turn.blocks += 1
          if (turn.blocks >= MAX_BLOCKS_PER_TURN && !turn.controller.signal.aborted) {
            turn.stopReason = `Stopped: the agent ran into ${turn.blocks} blocked or denied actions in one turn (last: ${reason}).`
            turn.controller.abort()
          }
        }
      },
      addPart: (part) => {
        turn.meter?.mark()
        message.parts.push(part)
        emitPart(part)
        this.phase(turn, 'tool', part.name, activityOf(part.name, part.args))
      },
      updatePart: (part) => {
        emitPart(part)
        if (part.ui?.status === 'pending') this.phase(turn, 'waiting', part.name)
        else if (part.status !== 'running') this.phase(turn, 'reading', part.name)
        else this.phase(turn, 'tool', part.name, activityOf(part.name, part.args))
        const used = this.active?.sessionId === sessionId ? this.active.chat.used : 0
        if (part.status !== 'running' && turn.usageBase && used) {
          const { fixed, before, size } = turn.usageBase
          this.emitEvent('context.usage', { sessionId, usage: usageOf(used, fixed, before, size, true) })
        }
      },
      output: (part, chunk) => this.emitEvent('tool.output', { sessionId, messageId: message.id, partId: part.id, chunk }),
      checkpoint: (absPath, previous) => this.checkpoints.save(sessionId, turn.userMessageId, absPath, previous),
      onBlocking: () => this.sessions.appendMessage(sessionId, copy(message)),
      repeats: (key) => {
        turn.lastCall = turn.lastCall?.key === key ? { key, count: turn.lastCall.count + 1 } : { key, count: 1 }
        return turn.lastCall.count
      },
      struggles: {
        count: (tool) => (turn.struggle?.tool === tool ? turn.struggle.count : 0),
        note: (tool, bad) => {
          turn.struggle = bad ? { tool, count: turn.struggle?.tool === tool ? turn.struggle.count + 1 : 1 } : null
        },
        reset: (tool) => {
          if (turn.struggle?.tool === tool) turn.struggle = null
        },
        stop: (tool) => {
          turn.stoppedTools = new Set([...(turn.stoppedTools ?? []), tool])
          if (turn.struggle?.tool === tool) turn.struggle = null
        },
        stopped: (tool) => turn.stoppedTools?.has(tool) === true
      },
      agentName: turn.agent.name,
      notify: (title, text) => this.emitEvent('ui.notify', { sessionId, title, message: text }),
      budget: this.budgetFor(sessionId, turn.agent),
      agentId: turn.agent.id,
      react: (state, reaction, seconds) => this.emitEvent('agent.reaction', { sessionId, state, reaction, seconds }),
      images: (ids) => {
        turn.pendingImages = [...(turn.pendingImages ?? []), ...ids]
      }
    }
  }

  private finish(turn: Turn, history: ChatHistoryItem[] | null): void {
    const { sessionId, message } = turn
    if (this.turn === turn) this.turn = null
    try {
      if (history) this.sessions.saveHistory(sessionId, history)
      if (history && turn.historyIndex !== undefined) this.sessions.saveTurnModel(sessionId, message.id, history.slice(turn.historyIndex))
      this.sessions.appendMessage(sessionId, message)
      this.sessions.update(sessionId, {})
      timeline.record({ kind: 'chat', entry: sessionId, action: 'talked', by: turn.agent.id, chat: sessionId })
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err)
      this.emitEvent('engine.error', { sessionId, message: `Could not save the session: ${text}` })
    }
    this.emitEvent('turn.finish', { sessionId, message: copy(message) })
    this.emit('finished', sessionId, copy(message))
    this.journal(turn)
  }

  private journal(turn: Turn): void {
    const { message } = turn
    const reply = message.parts.map((p) => (p.type === 'text' ? p.text : '')).join('').trim()
    const thoughts = message.parts.map((p) => (p.type === 'thought' ? p.text : '')).join('').trim()
    const tools = message.parts.flatMap((p) => (p.type === 'tool' ? [{ name: p.name, args: p.args, result: p.result ?? p.error ?? '' }] : []))
    if (!turn.prompt.trim() && !reply && !tools.length) return
    let title = 'Chat'
    try {
      title = this.sessions.get(turn.sessionId).title
    } catch {
      title = 'Chat'
    }
    minds
      .recordTurn(turn.agent.id, { at: message.createdAt, sessionId: turn.sessionId, sessionTitle: title, user: turn.prompt, reply, thoughts, tools, status: message.status })
      .catch((err) => this.emitEvent('engine.error', { sessionId: turn.sessionId, message: `Could not save this turn to the agent's journal: ${err instanceof Error ? err.message : String(err)}` }))
  }

  private fail(turn: Turn, err: unknown): void {
    if (turn.stopReason) {
      turn.message.status = 'error'
      turn.message.error = turn.stopReason
    } else if (turn.controller.signal.aborted) {
      turn.message.status = 'aborted'
    } else {
      turn.message.status = 'error'
      turn.message.error = err instanceof Error ? err.message : String(err)
      this.emitEvent('engine.error', { sessionId: turn.sessionId, message: turn.message.error })
    }
  }

  async send(sessionId: string, text: string, attachments: string[] = [], modelText?: string): Promise<{ userMessageId: string; assistantMessageId: string }> {
    const prompt = text.trim()
    const files = [...new Set(attachments)].map((id) => {
      const meta = data.assets.metaFor(id)
      if (!meta) throw new Error('One of the attached files was deleted. Remove it from the message, attach the file again, and send.')
      return meta
    })
    if (!prompt && !files.length) throw new Error('Type a message or attach a file before sending.')
    this.assertIdle(sessionId)
    const agent = this.agents.getOrDefault(this.sessions.get(sessionId).agentId)
    const { systemPrompt, tools } = this.instructionsFor(sessionId, agent)
    const ctx = this.sessions.loadContext(sessionId)
    const pending = ctx.summaries.find((s) => s.upTo === NEXT_TURN) ?? null
    const fileBlock = files.length
      ? secure.enabled
        ? `\n\n[Attached files. Read text, PDF, Word (.docx) and Excel (.xlsx) files with read_kind and the file id; copy other files into the workspace with file_export to open them with commands.]\n${files
            .map((f) => `- ${f.name} (id ${f.id}, ${f.kind}, ${f.size.toLocaleString()} bytes)${f.description ? `: ${f.description}` : ''}`)
            .join('\n')}`
        : `\n\n[Attached files. Read text, PDF, Word (.docx) and Excel (.xlsx) files with read_kind and the file id; other files can be opened by path.]\n${files
            .map((f) => `- ${f.name} (id ${f.id}, ${f.kind}, ${f.size.toLocaleString()} bytes, path ${data.assets.filePath(f)})${f.description ? `: ${f.description}` : ''}`)
            .join('\n')}`
      : ''
    const todos = this.sessions.todos(sessionId)
    const todoBlock = todos?.editedByUser ? `\n\n[The user changed your todo list:]\n${renderTodos(todos.items)}` : ''
    if (todos?.editedByUser) this.sessions.clearTodoEdit(sessionId)
    const probe = this.probeOf(sessionId)
    const boardBlock = tools.some((t) => t.name === 'read_messages') ? board.unseen(sessionId, 3) : ''
    const stated = withState(modelText ?? prompt) + referenceBlock(prompt) + fileBlock + todoBlock + boardBlock + (probe ? probeState(probe.pageId, this.sessions.messages(sessionId)) : '')
    let modelPrompt = pending ? `${summaryBlock(pending)}\n\n${stated}` : stated

    const placeholder: Turn = {
      sessionId,
      prompt,
      modelPrompt,
      agent,
      controller: new AbortController(),
      message: { id: '', role: 'assistant', parts: [], createdAt: 0, status: 'running' },
      userMessageId: '',
      blocks: 0,
      stopReason: null,
      lastCall: null
    }
    this.turn = placeholder
    let chat: ApiChat
    let modelId: string
    let checkIn: string | null = null
    this.preparing = true
    try {
      if (mindAuto(agent).recall && tools.some((t) => t.name === 'recall')) {
        const recalled = await recallBlock(agent.id, prompt).catch(() => '')
        if (recalled) {
          modelPrompt += recalled
          placeholder.modelPrompt = modelPrompt
        }
      }
      modelId = await this.ensureModel(agent, sessionId)
      chat = await this.ensureChat(sessionId, modelId, systemPrompt)
      const messages = this.sessions.messages(sessionId)
      checkIn = probe ? null : checkInText(messages, tools, agent.remindEvery ?? DEFAULT_REMIND_EVERY, activeSummary(ctx.summaries, messages))
      if (checkIn && !addCheckIn(chat, checkIn)) checkIn = null
      checkFits(chat.contextSize, systemPrompt, modelPrompt, tools)
    } catch (err) {
      this.turn = null
      throw err
    } finally {
      this.preparing = false
    }
    this.turn = null

    const turn = this.begin(sessionId, prompt, agent, placeholder.controller, chat.getChatHistory().length, files.map((f) => f.id))
    if (pending) this.sessions.saveContext(sessionId, { summaries: ctx.summaries.map((s) => (s.id === pending.id ? { ...s, upTo: turn.userMessageId } : s)) })
    turn.modelPrompt = modelPrompt
    turn.systemPrompt = systemPrompt
    turn.images = [...new Set([...files.filter((f) => f.kind === 'image').map((f) => f.id), ...linkImages(prompt)])]
    if (checkIn) {
      const part: ToolPart = { type: 'tool', id: newId('t'), name: CHECK_IN, args: {}, status: 'done', startedAt: Date.now(), durationMs: 0, result: checkIn }
      turn.message.parts.push(part)
      this.emitEvent('message.part', { sessionId, messageId: turn.message.id, part })
    }
    if (probe && !this.sessions.messages(sessionId).some((m) => m.role === 'assistant' && m.id !== turn.message.id)) {
      const part: ToolPart = { type: 'tool', id: newId('t'), name: 'probe_setup', args: {}, status: 'done', startedAt: Date.now(), durationMs: 0, result: probeBrief(agent, probe.subject, probe.pageId, tools) }
      turn.message.parts.push(part)
      this.emitEvent('message.part', { sessionId, messageId: turn.message.id, part })
    }
    void this.generate(turn, modelId, chat, tools)
    return { userMessageId: turn.userMessageId, assistantMessageId: turn.message.id }
  }

  private async generate(turn: Turn, modelId: string, chat: ApiChat, tools: ToolDef[]): Promise<void> {
    const { sessionId, message, controller } = turn
    const config = this.configFor(modelId, turn.agent, sessionId)
    const sampling = promptOptions(config, turn.agent.sampling)
    const functions = tools.length ? buildFunctions(tools, this.hooks(turn)) : undefined
    const local = chat.local
    const every = turn.agent.remindEvery ?? DEFAULT_REMIND_EVERY
    if (local && functions && every > 0)
      functions[CHECK_IN] = {
        description: 'Seven checks in every few turns.',
        params: { type: 'object', properties: {} },
        handler: () => {
          const messages = this.sessions.messages(sessionId)
          return checkInText(messages, tools, 1, activeSummary(this.sessions.loadContext(sessionId).summaries, messages)) ?? ''
        }
      }
    const takeImages = () => {
      const out = turn.pendingImages ?? []
      turn.pendingImages = []
      return out
    }
    const meter = new TurnMeter(chat)
    turn.meter = meter
    const definitions = functions ? Object.fromEntries(Object.entries(functions).map(([name, f]) => [name, { description: f.description, params: f.params }])) : {}
    const fixed = estimateTokens((turn.systemPrompt ?? '') + JSON.stringify(definitions))
    turn.usageBase = { fixed, before: chat.used || fixed + estimateTokens(JSON.stringify(chat.getChatHistory().filter((h) => h.type !== 'system'))), size: chat.contextSize }
    this.phase(turn, 'reading')
    try {
      await chat.prompt(turn.modelPrompt, {
        ...sampling,
        maxRounds: turn.agent.maxToolRounds || undefined,
        images: turn.images,
        takeImages,
        ...(local ? { extra: serverSampling(sampling, thinkingLevel(config)) } : {}),
        ...(functions ? { functions } : {}),
        signal: controller.signal,
        onFunctionCallParamsChunk: (chunk) => {
          meter.mark()
          this.phase(turn, 'calling', chunk.functionName)
          this.emitEvent('tool.draft', { sessionId, messageId: message.id, callIndex: chunk.callIndex, name: chunk.functionName, chunk: chunk.paramsChunk, done: chunk.done })
        },
        onResponseChunk: (chunk) => {
          meter.mark()
          if (chunk.type === 'segment') {
            if (chunk.segmentType !== 'thought' || !chunk.text) return
            this.phase(turn, 'thinking')
            appendText(message.parts, 'thought', chunk.text)
            this.emitEvent('thought.delta', { sessionId, messageId: message.id, text: chunk.text })
            return
          }
          if (!chunk.text) return
          this.phase(turn, 'writing')
          appendText(message.parts, 'text', chunk.text)
          this.emitEvent('text.delta', { sessionId, messageId: message.id, text: chunk.text })
        }
      })
      if (chat.capped) {
        turn.stopReason = `Stopped: ${turn.agent.name} reached its limit of ${turn.agent.maxToolRounds} tool rounds in one reply. Raise or turn off "Most tool rounds per reply" for ${turn.agent.name} in Agents.`
        this.fail(turn, new Error(turn.stopReason))
      } else if (controller.signal.aborted) this.fail(turn, new Error('Stopped'))
      else message.status = 'complete'
    } catch (err) {
      this.fail(turn, err)
    }
    const history = this.active?.chat === chat && !chat.disposed ? chat.getChatHistory() : null
    if (!chat.disposed) {
      try {
        message.stats = meter.finish()
        const st = message.stats
        const timings = local ? chat.timings : null
        if (timings) {
          if (timings.genTps !== null) st.tokensPerSecond = Math.round(timings.genTps * 10) / 10
          if (timings.promptTps !== null) st.promptPerSecond = Math.round(timings.promptTps * 10) / 10
          if (timings.drafted) st.predictions = { used: timings.accepted ?? 0, checked: timings.drafted }
        }
        if (local)
          try {
            recordTurn({
              at: Date.now(),
              modelId,
              modelName: this.models.get(modelId).name,
              contextSize: st.contextSize,
              gpuLayers: this.host.gpuLayers,
              sessionId,
              evalTokens: st.evalTokens ?? 0,
              evalMs: st.evalMs ?? 0,
              genTokens: st.genTokens ?? st.outputTokens,
              genMs: st.genPureMs ?? st.genMs,
              toolMs: st.toolMs ?? 0,
              ttftMs: st.ttftMs,
              contextUsed: st.contextUsed
            })
          } catch (err) {
            console.warn('Could not record turn stats:', err instanceof Error ? err.message : err)
          }
        if (history && turn.usageBase) {
          const usage = usageOf(chat.used || turn.usageBase.before, turn.usageBase.fixed, turn.usageBase.before, turn.usageBase.size)
          this.sessions.saveContext(sessionId, { usage })
          this.emitEvent('context.usage', { sessionId, usage })
        }
      } catch {
        message.stats = undefined
      }
    }
    this.finish(turn, history)
    this.maintain(sessionId)
  }

  private maintain(sessionId: string, fresh = false): void {
    if (this.turn || this.compacting) return
    try {
      const agent = this.agents.getOrDefault(this.sessions.get(sessionId).agentId)
      if (!this.remoteModel(agent) && !this.host.isLoaded) return
      const { systemPrompt, tools } = this.instructionsFor(sessionId, agent)
      const saved = this.sessions.loadContext(sessionId).usage
      let usage = fresh ? this.measure(systemPrompt, tools, this.sessions.loadHistory(sessionId) ?? [], agent) : saved
      if (!usage) return
      if (usage.used / usage.size >= agent.context.trimAt) {
        const messages = this.sessions.messages(sessionId)
        const summary = activeSummary(this.sessions.loadContext(sessionId).summaries, messages)
        const plan = planTrim(messages, this.sessions.turnModels(sessionId), summary, agent.context.keepTurns, (t) => this.count(t), this.fitFor(sessionId))
        if (plan.parts.length) {
          for (const m of applyTrim(plan, this.sessions.outputsDir(sessionId))) this.sessions.appendMessage(sessionId, m)
          const history = this.rebuildFor(sessionId, systemPrompt)
          this.applyHistory(sessionId, history)
          usage = this.measure(systemPrompt, tools, history, agent) ?? usage
          this.emitEvent('context.compacted', { sessionId, trimmed: plan.parts.length, summarised: 0 })
        }
      }
      if (usage !== saved) {
        this.sessions.saveContext(sessionId, { usage })
        this.emitEvent('context.usage', { sessionId, usage })
      }
      if (agent.context.autoSummary && usage.used / usage.size >= agent.context.summaryAt) {
        try {
          this.compact(sessionId)
        } catch {
          return
        }
      }
    } catch (err) {
      this.emitEvent('engine.error', { sessionId, message: `Could not tidy the chat's context: ${err instanceof Error ? err.message : String(err)}` })
    }
  }

  compact(sessionId: string): { turns: number } {
    this.assertIdle(sessionId)
    const agent = this.agents.getOrDefault(this.sessions.get(sessionId).agentId)
    const { systemPrompt, tools } = this.instructionsFor(sessionId, agent)
    const messages = this.sessions.messages(sessionId)
    const ctx = this.sessions.loadContext(sessionId)
    const current = activeSummary(ctx.summaries, messages)
    const plan = planSummary(messages, current, agent.context.keepTurns)
    if (!plan) throw new Error(`There is nothing old enough to summarise yet: the last ${agent.context.keepTurns} turns are always kept in full. Keep chatting, or lower that number for ${agent.name} in Agents.`)
    const controller = new AbortController()
    this.compacting = { sessionId, controller }
    this.emitEvent('context.compacting', { sessionId, active: true })
    void this.runCompact(sessionId, agent, systemPrompt, tools, plan, current, controller)
    return { turns: plan.turns }
  }

  private async summarise(chat: ApiChat, modelId: string, agent: AgentProfile, tools: ToolDef[], withTools: boolean, signal: AbortSignal, request: (maxWords: number) => string = summaryRequest) {
    const maxTokens = Math.max(256, Math.min(2048, Math.floor(chat.contextSize * 0.12)))
    const local = new AbortController()
    const stop = () => local.abort()
    signal.addEventListener('abort', stop)
    let calls = 0
    const functions =
      withTools && tools.length
        ? Object.fromEntries(
            tools.map((t) => [
              t.name,
              {
                description: t.description,
                params: t.params,
                handler: () => {
                  calls += 1
                  if (calls > 1) local.abort()
                  return TOOLS_OFF
                }
              }
            ])
          )
        : undefined
    const config = this.configFor(modelId, agent)
    const sampling = promptOptions(config, agent.sampling)
    try {
      const text = await chat.prompt(request(Math.floor(maxTokens * 0.6)), {
        ...sampling,
        ...(chat.local ? { extra: serverSampling(sampling, thinkingLevel(config)) } : {}),
        ...(functions ? { functions } : {}),
        maxTokens,
        signal: local.signal
      })
      return { text: text.trim(), toolLoop: calls > 1 }
    } finally {
      signal.removeEventListener('abort', stop)
    }
  }

  private async runCompact(
    sessionId: string,
    agent: AgentProfile,
    systemPrompt: string,
    tools: ToolDef[],
    plan: NonNullable<ReturnType<typeof planSummary>>,
    current: ContextSummary | null,
    controller: AbortController
  ): Promise<void> {
    let chat: ApiChat | null = null
    let full: ChatHistoryItem[] | null = null
    let done = false
    try {
      const modelId = await this.ensureModel(agent, sessionId)
      chat = await this.ensureChat(sessionId, modelId, systemPrompt)
      full = chat.getChatHistory()
      const before = rebuildHistory({ systemPrompt, messages: plan.before, slices: this.sessions.turnModels(sessionId), summary: current, fit: this.fitFor(sessionId) })
      chat.setChatHistory(before)
      let result = await this.summarise(chat, modelId, agent, tools, true, controller.signal)
      if (result.toolLoop && !controller.signal.aborted) {
        chat.setChatHistory(before)
        result = await this.summarise(chat, modelId, agent, tools, false, controller.signal)
      }
      if (controller.signal.aborted) throw new Error('Summary cancelled')
      if (!result.text) throw new Error('The model wrote an empty summary. Try summarising again; if it keeps happening, give this agent a different model in Agents.')
      const summary: ContextSummary = { id: newId('sum'), upTo: plan.upTo, text: result.text, turns: plan.turns, createdAt: Date.now() }
      this.sessions.saveContext(sessionId, { summaries: [...this.sessions.loadContext(sessionId).summaries, summary] })
      const history = this.rebuildFor(sessionId, systemPrompt)
      done = true
      this.applyHistory(sessionId, history)
      const usage = this.measure(systemPrompt, tools, history, agent)
      if (usage) {
        this.sessions.saveContext(sessionId, { usage })
        this.emitEvent('context.usage', { sessionId, usage })
      }
    } catch (err) {
      if (chat && full && !done && !chat.disposed) chat.setChatHistory(full)
      if (!controller.signal.aborted) {
        this.emitEvent('engine.error', { sessionId, message: `Could not summarise the chat: ${err instanceof Error ? err.message : String(err)}` })
      }
    } finally {
      this.compacting = null
      this.emitEvent('context.compacting', { sessionId, active: false })
      if (done) this.emitEvent('context.compacted', { sessionId, trimmed: 0, summarised: plan.turns })
    }
  }

  async runToolCommand(sessionId: string, line: string, tool: ToolDef, args: Record<string, unknown>): Promise<string> {
    this.assertIdle(sessionId)
    const agent = this.agents.getOrDefault(this.sessions.get(sessionId).agentId)
    const turn = this.begin(sessionId, line, agent, new AbortController())
    let result = ''
    try {
      result = await runTool(tool, args, this.hooks(turn))
      if (turn.controller.signal.aborted) this.fail(turn, new Error('Stopped'))
      else turn.message.status = 'complete'
    } catch (err) {
      this.fail(turn, err)
    }
    this.finish(turn, null)
    this.applyHistory(sessionId, this.rebuildFor(sessionId, this.instructionsFor(sessionId, agent).systemPrompt))
    return result
  }

  async handoff(sessionId: string): Promise<string> {
    this.assertIdle(sessionId)
    if (!this.sessions.messages(sessionId).length) throw new Error('This chat is empty, so there is nothing to hand off. Send a message first, or just start a new chat.')
    const agent = this.agents.getOrDefault(this.sessions.get(sessionId).agentId)
    const { systemPrompt, tools } = this.instructionsFor(sessionId, agent)
    const controller = new AbortController()
    this.compacting = { sessionId, controller }
    this.emitEvent('context.compacting', { sessionId, active: true })
    let chat: ApiChat | null = null
    let full: ChatHistoryItem[] | null = null
    try {
      const modelId = await this.ensureModel(agent, sessionId)
      chat = await this.ensureChat(sessionId, modelId, systemPrompt)
      full = chat.getChatHistory()
      let result = await this.summarise(chat, modelId, agent, tools, true, controller.signal, handoffRequest)
      if (result.toolLoop && !controller.signal.aborted) {
        chat.setChatHistory(full)
        result = await this.summarise(chat, modelId, agent, tools, false, controller.signal, handoffRequest)
      }
      if (controller.signal.aborted) throw new Error('Handoff cancelled')
      if (!result.text) throw new Error('The model wrote an empty handoff. Run /offboard again; if it keeps happening, give this agent a different model in Agents.')
      return result.text
    } finally {
      if (chat && full && !chat.disposed) chat.setChatHistory(full)
      this.compacting = null
      this.emitEvent('context.compacting', { sessionId, active: false })
    }
  }

  async simulate(sessionId: string, prompt: string, calls: { name: string; args: Record<string, unknown> }[]): Promise<boolean> {
    this.assertIdle(sessionId)
    const agent = this.agents.getOrDefault(this.sessions.get(sessionId).agentId)
    const turn = this.begin(sessionId, prompt, agent, new AbortController())
    const hooks = this.hooks(turn)
    try {
      for (const call of calls) {
        const tool = findTool(call.name)
        if (!tool) throw new Error(`Unknown tool: ${call.name}`)
        const result = await runTool(tool, call.args, hooks)
        if (turn.controller.signal.aborted) break
        appendText(turn.message.parts, 'text', `\n${call.name} returned ${result.length} characters.\n`)
        this.emitEvent('text.delta', { sessionId, messageId: turn.message.id, text: `\n${call.name} returned ${result.length} characters.\n` })
      }
      if (turn.controller.signal.aborted) this.fail(turn, new Error('Stopped'))
      else turn.message.status = 'complete'
    } catch (err) {
      this.fail(turn, err)
    }
    this.finish(turn, null)
    this.applyHistory(sessionId, this.rebuildFor(sessionId, this.instructionsFor(sessionId, agent).systemPrompt))
    return true
  }

  private rewindPlan(sessionId: string, messageId: string) {
    if (this.turn?.sessionId === sessionId) throw new ChatBusy('A reply is still being written in this chat. Stop it first, then rewind.')
    if (this.compacting?.sessionId === sessionId) throw new ChatBusy('This chat is being summarised. Wait for the summary to finish, then try again.')
    const messages = this.sessions.messages(sessionId)
    const index = messages.findIndex((m) => m.id === messageId)
    const target = messages[index]
    if (!target || target.role !== 'user') throw new Error('Rewind works from one of your own messages. Pick a message you sent, not a reply.')
    const later = messages.slice(index)
    const turnIds = later.filter((m) => m.role === 'user').map((m) => m.id)
    const commands = later
      .flatMap((m) => m.parts)
      .filter((p) => p.type === 'tool' && p.name === 'run_command' && (p.status === 'done' || p.status === 'error')).length
    const text = target.parts.map((p) => (p.type === 'text' ? p.text : '')).join('')
    return { messages, index, target, later, turnIds, commands, text }
  }

  private relative(sessionId: string, abs: string): string {
    const described = data.describe(abs)
    if (described) return described
    const workspace = this.agents.getOrDefault(this.sessions.get(sessionId).agentId).workspace
    if (!workspace) return abs
    const rel = path.relative(workspace, abs)
    return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel.split(path.sep).join('/') : abs
  }

  rewindPreview(sessionId: string, messageId: string): RewindPreview {
    const plan = this.rewindPlan(sessionId, messageId)
    return {
      files: [...new Set(this.checkpoints.files(sessionId, plan.turnIds).map((f) => this.relative(sessionId, f)))],
      commands: plan.commands,
      messagesRemoved: plan.later.length,
      text: plan.text
    }
  }

  rewind(sessionId: string, messageId: string): { text: string; restored: string[] } {
    const plan = this.rewindPlan(sessionId, messageId)
    const restored = this.checkpoints.restore(sessionId, plan.turnIds)
    data.refresh(restored)
    const kept = new Set(plan.messages.slice(0, plan.index).map((m) => m.id))
    this.sessions.truncate(sessionId, kept)
    const summaries = this.sessions
      .loadContext(sessionId)
      .summaries.filter((s) => s.upTo === NEXT_TURN || kept.has(s.upTo) || s.upTo === plan.target.id)
      .map((s) => (s.upTo === plan.target.id ? { ...s, upTo: NEXT_TURN } : s))
    const pending = summaries.findIndex((s) => s.upTo === NEXT_TURN)
    this.sessions.saveContext(sessionId, { usage: null, summaries: pending > -1 ? summaries.slice(0, pending + 1) : summaries })
    this.forget(sessionId)
    const agent = this.agents.getOrDefault(this.sessions.get(sessionId).agentId)
    if (kept.size) {
      this.sessions.saveHistory(sessionId, this.rebuildFor(sessionId, this.instructionsFor(sessionId, agent).systemPrompt))
      this.maintain(sessionId, true)
    } else this.sessions.clearHistory(sessionId)
    this.sessions.update(sessionId, {})
    this.emitEvent('session.rewritten', { sessionId })
    return { text: plan.text, restored: [...new Set(restored.map((f) => this.relative(sessionId, f)))] }
  }

  fork(sessionId: string, messageId: string): { session: SessionMeta; text: string } {
    if (this.turn?.sessionId === sessionId) throw new ChatBusy('A reply is still being written in this chat. Stop it first, then fork.')
    if (this.compacting?.sessionId === sessionId) throw new ChatBusy('This chat is being summarised. Wait for the summary to finish, then try again.')
    const messages = this.sessions.messages(sessionId)
    const index = messages.findIndex((m) => m.id === messageId)
    const target = messages[index]
    if (!target) throw new Error('That message is not in this chat')
    const fromUser = target.role === 'user'
    const keptMessages = messages.slice(0, fromUser ? index : index + 1)
    const kept = new Set(keptMessages.map((m) => m.id))
    const whole = keptMessages.length === messages.length
    const source = this.sessions.loadContext(sessionId)
    const summaries = source.summaries
      .filter((s) => kept.has(s.upTo) || (fromUser && s.upTo === target.id) || (whole && s.upTo === NEXT_TURN))
      .map((s) => (fromUser && s.upTo === target.id ? { ...s, upTo: NEXT_TURN } : s))
    const pending = summaries.findIndex((s) => s.upTo === NEXT_TURN)
    const session = this.sessions.fork(sessionId, keptMessages, {
      instructions: source.instructions,
      usage: null,
      summaries: pending > -1 ? summaries.slice(0, pending + 1) : summaries
    })
    if (keptMessages.length) {
      const agent = this.agents.getOrDefault(session.agentId)
      this.sessions.saveHistory(session.id, this.rebuildFor(session.id, this.instructionsFor(session.id, agent).systemPrompt))
    }
    return { session, text: fromUser ? target.parts.map((p) => (p.type === 'text' ? p.text : '')).join('') : '' }
  }

  abort(sessionId: string): boolean {
    if (this.compacting?.sessionId === sessionId) {
      this.compacting.controller.abort()
      return true
    }
    if (this.turn?.sessionId !== sessionId) return false
    this.turn.controller.abort()
    return true
  }
}

function addCheckIn(chat: ApiChat, text: string): boolean {
  const history = chat.getChatHistory()
  const last = history[history.length - 1]
  if (last?.type !== 'model') return false
  chat.setChatHistory([...history.slice(0, -1), { ...last, response: [...last.response, { type: 'functionCall', name: CHECK_IN, description: 'Seven checks in every few turns.', params: {}, result: text, startsNewChunk: true }] }])
  return true
}
