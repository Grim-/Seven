import { noteFailure } from '../util/report'
import { notFound } from '@shared/errors'
import type { AgentPreset } from './presets'
import { isAssetId } from '@shared/ids'
import { CORE_MODULES } from '@shared/toolnames'
import { cleanAvatarRef } from '@shared/avatars'
import { cleanRelationships, type RelationshipEntry } from '@shared/relationships'
import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { cleanVoice, DEFAULT_CONTEXT, DEFAULT_LIBRARY_ACCESS, DEFAULT_LOOK, type LibraryAccess, type AgentLook, PERMISSION_MODES, SAMPLING_KEYS, THINKING_LEVELS, type ThinkingLevel, TOOL_CHOICE_MODES, type ToolChoiceMode, type AgentDraft, type ContextSettings, type AgentProfile, type PermissionMode, type SamplingOverrides } from '@shared/types'
import { paths } from '../util/paths'
import { newId, readJson, removePath, writeJson } from '../util/fs'
import { secure, vaultEvents } from '../util/secure'
import { dataRoot } from '../util/paths'
import { timeline } from '../timeline/store'

export const DEFAULT_AGENT_ID = 'seven'

const DEFAULT_PROMPT = [
  'You are Seven, a personal assistant running locally on the user\'s own computer.',
  'Be direct and concise. Use Markdown when it helps readability.',
  'If you are unsure about something, say so plainly.'
].join('\n')

function cleanThinking(v: unknown): ThinkingLevel | null {
  return (THINKING_LEVELS as readonly unknown[]).includes(v) ? (v as ThinkingLevel) : null
}

function cleanToolChoice(v: unknown): ToolChoiceMode | null {
  return (TOOL_CHOICE_MODES as readonly unknown[]).includes(v) ? (v as ToolChoiceMode) : null
}

function cleanSampling(input: SamplingOverrides | undefined): SamplingOverrides {
  const out: SamplingOverrides = {}
  if (!input) return out
  for (const key of SAMPLING_KEYS) {
    const value = input[key]
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
  }
  return out
}

function cleanIds(input: unknown): string[] {
  return Array.isArray(input) ? [...new Set(input.filter((id): id is string => typeof id === 'string' && /^[\w-]{1,64}$/.test(id)))] : []
}

function cleanMindAuto(input: unknown): { recall: boolean; recallCooldown: number } {
  const v = (input && typeof input === 'object' ? input : {}) as { recall?: unknown; recallCooldown?: unknown }
  const cd = typeof v.recallCooldown === 'number' && Number.isFinite(v.recallCooldown) ? Math.max(0, Math.min(50, Math.round(v.recallCooldown))) : 0
  return { recall: v.recall !== false, recallCooldown: cd }
}

export const DEFAULT_REMIND_EVERY = 5

function cleanRemindEvery(input: unknown): number {
  return typeof input === 'number' && Number.isFinite(input) ? Math.max(0, Math.min(100, Math.round(input))) : DEFAULT_REMIND_EVERY
}

function cleanMaxToolRounds(input: unknown): number {
  return typeof input === 'number' && Number.isFinite(input) ? Math.max(0, Math.round(input)) : 0
}

function cleanTools(input: unknown): string[] {
  return Array.isArray(input) ? [...new Set(input.filter((n): n is string => typeof n === 'string' && /^[A-Za-z][\w]{0,63}$/.test(n)))] : []
}

function cleanModules(input: unknown): string[] {
  if (!Array.isArray(input)) return ['ui']
  return [...new Set(input.filter((id): id is string => typeof id === 'string' && /^[a-z][a-z0-9-]{0,47}$/.test(id)).map((id) => (id === 'scratchpad' ? 'vault' : id === 'data' ? 'core' : id)))]
}

function cleanMode(input: unknown): PermissionMode {
  return PERMISSION_MODES.some((m) => m.id === input) ? (input as PermissionMode) : 'ask'
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, n))
}

const HEX = /^#[0-9a-f]{6}$/i

function cleanColor(value: unknown): string | null {
  return typeof value === 'string' && HEX.test(value.trim()) ? value.trim().toLowerCase() : null
}

function cleanAsset(value: unknown): string | null {
  return isAssetId(value) ? value : null
}

export function cleanLook(input: unknown): AgentLook {
  const v = (input ?? {}) as Partial<AgentLook> & Record<string, unknown>
  const avatar = cleanAvatarRef(v.avatar)
  return {
    avatar,
    accent: cleanColor(v.accent),
    background: cleanAsset(v.background),
    tint: cleanColor(v.tint),
    tintStrength: num(v.tintStrength, DEFAULT_LOOK.tintStrength, 0, 1),
    backgroundOpacity: num(v.backgroundOpacity, DEFAULT_LOOK.backgroundOpacity, 0, 1)
  }
}

function cleanContext(input: unknown): ContextSettings {
  const value = (input ?? {}) as Partial<ContextSettings>
  const trimAt = num(value.trimAt, DEFAULT_CONTEXT.trimAt, 0.3, 0.95)
  return {
    outputShare: num(value.outputShare, DEFAULT_CONTEXT.outputShare, 0.04, 0.4),
    trimAt,
    keepTurns: Math.round(num(value.keepTurns, DEFAULT_CONTEXT.keepTurns, 1, 20)),
    summaryAt: num(value.summaryAt, DEFAULT_CONTEXT.summaryAt, Math.min(0.98, trimAt + 0.02), 0.98),
    autoSummary: typeof value.autoSummary === 'boolean' ? value.autoSummary : DEFAULT_CONTEXT.autoSummary
  }
}

function cleanWorkspace(input: unknown): string | null {
  return typeof input === 'string' && input.trim() ? input.trim() : null
}

const PRIVATE_DIR = path.join(dataRoot, 'vault-agents')

function cleanLibrary(input: unknown): LibraryAccess {
  const v = (input && typeof input === 'object' ? input : {}) as Partial<LibraryAccess>
  const hidden = Array.isArray(v.hidden) ? [...new Set(v.hidden.filter((h): h is string => typeof h === 'string' && /^[a-z0-9._-]+$/.test(h)))] : []
  const chats = v.chats === 'none' || v.chats === 'all' || v.chats === 'own' ? v.chats : DEFAULT_LIBRARY_ACCESS.chats
  return { hidden, chats }
}

function cleanLoaded(agent: AgentProfile, priv: boolean): AgentProfile {
  const relationships = cleanRelationships(agent.relationships)
  return {
    ...agent,
    sampling: cleanSampling(agent.sampling),
    workspace: cleanWorkspace(agent.workspace),
    modules: cleanModules((agent as { modules?: unknown; toolGroups?: unknown }).modules ?? (agent as { toolGroups?: unknown }).toolGroups),
    permissionMode: cleanMode(agent.permissionMode),
    context: cleanContext(agent.context),
    look: cleanLook((agent as { look?: unknown }).look),
    library: cleanLibrary(agent.library),
    ...(relationships.length ? { relationships } : { relationships: undefined }),
    private: priv
  }
}

export interface AgentFolders {
  make(name: string): string | null
  rename(folder: string, name: string): void
}

export class AgentRegistry extends EventEmitter {
  private agents = new Map<string, AgentProfile>()
  private folders: AgentFolders | null = null

  constructor() {
    super()
    fs.mkdirSync(paths.agents, { recursive: true })
    for (const file of fs.readdirSync(paths.agents)) {
      if (!file.endsWith('.json')) continue
      const agent = readJson<AgentProfile | null>(path.join(paths.agents, file), null)
      if (agent?.id) this.agents.set(agent.id, cleanLoaded(agent, false))
    }
    vaultEvents.on('unlocked', () => {
      this.loadPrivate()
      this.giveFolders()
    })
    vaultEvents.on('locked', () => this.dropPrivate())
    if (secure.unlocked) this.loadPrivate()
    if (!this.agents.has(DEFAULT_AGENT_ID)) {
      const now = Date.now()
      this.write({
        id: DEFAULT_AGENT_ID,
        name: 'Seven',
        description: 'General assistant. Uses whichever model is loaded.',
        modelId: null,
        systemPrompt: DEFAULT_PROMPT,
        sampling: {},
        workspace: null,
        modules: [...CORE_MODULES, 'ui'],
        permissionMode: 'ask',
        context: { ...DEFAULT_CONTEXT },
        look: { ...DEFAULT_LOOK, avatar: { kind: 'avatar', id: 'ascii_face' } },
        createdAt: now,
        updatedAt: now
      })
    }
  }

  private loadPrivate(): void {
    if (!fs.existsSync(PRIVATE_DIR)) return
    try {
      for (const file of fs.readdirSync(PRIVATE_DIR)) {
        if (!file.endsWith('.json')) continue
        const agent = readJson<AgentProfile | null>(path.join(PRIVATE_DIR, file), null)
        if (agent?.id) this.agents.set(agent.id, cleanLoaded(agent, true))
      }
    } catch (err) {
      noteFailure(err, 'agents', 'Could not read the private agents')
      return
    }
    this.emit('changed', this.list())
  }

  useFolders(folders: AgentFolders): void {
    this.folders = folders
    this.giveFolders()
  }

  private foldersReady(): boolean {
    return this.folders !== null && (!secure.enabled || secure.unlocked)
  }

  private giveFolders(): void {
    if (!this.folders || !this.foldersReady()) return
    let changed = false
    for (const agent of this.agents.values()) {
      if (agent.folder !== undefined) continue
      this.write({ ...agent, folder: this.folders.make(agent.name) })
      changed = true
    }
    if (changed) this.emit('changed', this.list())
  }

  private dropPrivate(): void {
    let dropped = false
    for (const [id, agent] of this.agents)
      if (agent.private) {
        this.agents.delete(id)
        dropped = true
      }
    if (dropped) this.emit('changed', this.list())
  }

  private file(id: string, priv = false): string {
    return path.join(priv ? PRIVATE_DIR : paths.agents, `${id}.json`)
  }

  private write(agent: AgentProfile): void {
    this.agents.set(agent.id, agent)
    if (agent.private) fs.mkdirSync(PRIVATE_DIR, { recursive: true })
    writeJson(this.file(agent.id, agent.private === true), agent)
  }

  list(): AgentProfile[] {
    return [...this.agents.values()].sort((a, b) => {
      if (a.id === DEFAULT_AGENT_ID) return -1
      if (b.id === DEFAULT_AGENT_ID) return 1
      return a.name.localeCompare(b.name)
    })
  }

  find(id: string): AgentProfile | null {
    return this.agents.get(id) ?? null
  }

  get(id: string): AgentProfile {
    const agent = this.agents.get(id)
    if (!agent) throw notFound(new Error('That agent no longer exists. Pick another one in Agents.'))
    return agent
  }

  getOrDefault(id: string): AgentProfile {
    return this.agents.get(id) ?? this.get(DEFAULT_AGENT_ID)
  }

  /** Provisions a module-registered agent preset once without ever overwriting an existing user-edited profile. */
  ensurePreset(preset: AgentPreset): AgentProfile {
    const existing = this.agents.get(preset.id)
    if (existing) return existing
    const now = Date.now()
    const folder = this.folders && this.foldersReady() ? this.folders.make(preset.name) : undefined
    const agent: AgentProfile = {
      id: preset.id,
      name: preset.name,
      description: preset.description,
      modelId: null,
      systemPrompt: preset.systemPrompt,
      sampling: {},
      workspace: null,
      modules: cleanModules(preset.modules),
      permissionMode: cleanMode(preset.permissionMode),
      context: { ...DEFAULT_CONTEXT },
      look: { ...DEFAULT_LOOK },
      roleplay: preset.roleplay === true,
      ...(folder !== undefined ? { folder } : {}),
      createdAt: now,
      updatedAt: now
    }
    this.write(agent)
    this.emit('changed', this.list())
    return agent
  }

  save(draft: AgentDraft): AgentProfile {
    const name = draft.name?.trim()
    if (!name) throw new Error('Give the agent a name, then save again.')
    const existing = draft.id ? this.agents.get(draft.id) : undefined
    const now = Date.now()
    const agent: AgentProfile = {
      id: existing?.id ?? newId('agent'),
      name,
      description: draft.description?.trim() ?? '',
      modelId: draft.modelId || null,
      systemPrompt: draft.systemPrompt ?? '',
      sampling: cleanSampling(draft.sampling),
      workspace: cleanWorkspace(draft.workspace),
      modules: cleanModules(draft.modules),
      permissionMode: cleanMode(draft.permissionMode),
      context: cleanContext({ ...existing?.context, ...draft.context }),
      look: cleanLook({ ...existing?.look, ...draft.look }),
      toolsets: cleanIds(draft.toolsets === undefined ? existing?.toolsets : draft.toolsets),
      offTools: cleanTools(draft.offTools === undefined ? existing?.offTools : draft.offTools),
      private: (draft.private ?? existing?.private) === true,
      roleplay: (draft.roleplay ?? existing?.roleplay) === true,
      library: cleanLibrary(draft.library === undefined ? existing?.library : draft.library),
      theme: (draft.theme === undefined ? existing?.theme : draft.theme) || null,
      voice: cleanVoice(draft.voice === undefined ? existing?.voice : draft.voice),
      readAloud: (draft.readAloud ?? existing?.readAloud) === true,
      reasoningStyle: (draft.reasoningStyle === undefined ? existing?.reasoningStyle : draft.reasoningStyle) || null,
      thinking: cleanThinking(draft.thinking === undefined ? existing?.thinking : draft.thinking),
      toolChoice: cleanToolChoice(draft.toolChoice === undefined ? existing?.toolChoice : draft.toolChoice),
      sheet: (draft.sheets?.[0] ?? (draft.sheet === undefined ? existing?.sheet : draft.sheet)) || null,
      sheets: draft.sheets !== undefined
        ? (draft.sheets ?? [])
        : existing?.sheets ?? (draft.sheet ? [draft.sheet] : existing?.sheet ? [existing.sheet] : []),
      player: (draft.player === undefined ? existing?.player : draft.player) || null,
      relationships: cleanRelationships(draft.relationships === undefined ? existing?.relationships : draft.relationships),
      mindAuto: cleanMindAuto(draft.mindAuto === undefined ? existing?.mindAuto : draft.mindAuto),
      remindEvery: cleanRemindEvery(draft.remindEvery === undefined ? existing?.remindEvery : draft.remindEvery),
      maxToolRounds: cleanMaxToolRounds(draft.maxToolRounds === undefined ? existing?.maxToolRounds : draft.maxToolRounds),
      folder: existing ? existing.folder : undefined,
      incognito: (draft.incognito ?? existing?.incognito) === true,
      createdBy: existing ? (existing.createdBy ?? null) : typeof draft.createdBy === 'string' ? draft.createdBy : null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }
    if (agent.private && agent.id === DEFAULT_AGENT_ID) throw new Error("The default agent can't be kept in the vault. Set it back to Always listed, or make a new agent to keep in the vault.")
    if (agent.private && !secure.enabled) throw new Error('Set up the vault in Settings first')
    if (agent.private && !secure.unlocked) throw new Error('Unlock the vault to keep an agent in it')
    if (this.folders && this.foldersReady()) {
      if (agent.folder === undefined) agent.folder = this.folders.make(agent.name)
      else if (existing && existing.name !== agent.name && agent.folder) this.folders.rename(agent.folder, agent.name)
    }
    this.write(agent)
    if (existing && (existing.private === true) !== agent.private) removePath(this.file(agent.id, existing.private === true))
    timeline.record({ kind: 'agent', entry: agent.id, action: existing ? 'changed' : 'made' })
    this.emit('changed', this.list())
    if (JSON.stringify(existing?.relationships ?? []) !== JSON.stringify(agent.relationships ?? [])) {
      this.emit('relationships', agent)
    }
    return agent
  }

  setRelationships(id: string, list: RelationshipEntry[]): AgentProfile {
    const existing = this.get(id)
    if (existing.private && !secure.unlocked) throw new Error('Unlock the vault to change a vault agent')
    const relationships = cleanRelationships(list)
    const agent: AgentProfile = { ...existing, relationships, updatedAt: Date.now() }
    this.write(agent)
    timeline.record({ kind: 'agent', entry: agent.id, action: 'changed' })
    this.emit('changed', this.list())
    this.emit('relationships', agent)
    return agent
  }

  delete(id: string): boolean {
    if (id === DEFAULT_AGENT_ID) throw new Error("The default agent can't be deleted. Change its name, model or instructions in Agents instead.")
    const agent = this.agents.get(id)
    if (!agent || !this.agents.delete(id)) return false
    removePath(this.file(id, agent.private === true))
    timeline.forget('agent', id)
    timeline.forget('memory', id)
    this.emit('changed', this.list())
    return true
  }
}
