import type { ProblemPrefs } from './problems'
import type { PortabilityPrefs } from './portability'
import type { EntityRecord } from './game/core/GameEntity'
import { isAssetId } from './ids'
import type { DndStats } from './dnd'
import type { Story, StoryMemory } from './story'
import type { RelationshipEntry } from './relationships'
import type { WorldBinding } from './world'
import type { PickDecisionProps } from './pickDecision'
import type { RolledDecisionProps } from './rolledDecision'
import type { OpposedProps } from './opposedCheck'
import type { ParamSchema } from './game/core/params'
import type { MoodName } from './moods'
import type { ChatElement } from './chatElements'
import type { SessionSceneBinding } from './almanac'
export type ModelStatus = 'unloaded' | 'loading' | 'ready' | 'error'

export type RemoteApi = 'openai' | 'anthropic' | 'google'

export interface RemoteSpec {
  api: RemoteApi
  baseUrl: string | null
  model: string
  hasKey: boolean
  category?: 'chat' | 'reasoning' | 'image' | 'audio' | 'other'
}

export interface ModelEntry {
  id: string
  name: string
  remote?: RemoteSpec | null
  path: string
  sizeBytes: number
  quant: string | null
  folder: string | null
  favourite?: boolean
  lastUsedAt?: number
  info?: ModelInfo | null
  kindChosen?: boolean
}

export const MODEL_KINDS = {
  chat: { label: 'Chat', plural: 'Chat', runnable: true, chats: true, always: true, listed: true, note: null },
  embedding: { label: 'Embedding', plural: 'Embedding', runnable: true, chats: false, always: true, listed: true, note: null },
  image: { label: 'Image', plural: 'Image', runnable: true, chats: false, always: true, listed: true, note: null },
  projector: { label: 'Vision adapter', plural: 'Vision adapters', runnable: false, chats: false, always: false, listed: false, note: 'A vision adapter goes with a model; it is not a model of its own.' },
  vae: { label: 'VAE', plural: 'VAEs', runnable: false, chats: false, always: false, listed: false, note: 'A VAE goes with a diffusion image model; it is not a model of its own.' },
  text_encoder: {
    label: 'Text encoder',
    plural: 'Text encoders',
    runnable: false,
    chats: false,
    always: false,
    listed: false,
    note: 'A text encoder (CLIP or T5XXL) goes with a diffusion image model; it is not a model of its own.'
  },
  lora: {
    label: 'LoRA',
    plural: 'LoRAs',
    runnable: false,
    chats: false,
    always: false,
    listed: false,
    note: 'A LoRA adapter modifies a diffusion image model; it is not a standalone model.'
  },
  imatrix: {
    label: 'Importance matrix',
    plural: 'Importance matrices',
    runnable: false,
    chats: false,
    always: false,
    listed: false,
    note: 'An importance matrix is only used when a model is quantized. It is not a model, and running a model never reads it: a model made with one has it built in.'
  },
  other: { label: 'Other', plural: 'Other', runnable: true, chats: true, always: false, listed: true, note: null }
} as const

export type ModelKind = keyof typeof MODEL_KINDS

export type HubFamily = 'image-packs' | 'gguf' | 'diffusion' | 'image-gguf' | 'image-companions'

export type ImagePipelineMode = 'auto' | 'model' | 'diffusion'

export interface ImageModelConfig {
  mode: ImagePipelineMode
  vae: string | null
  tae: string | null
  clipL: string | null
  clipG: string | null
  t5xxl: string | null
  llm: string | null
  llmVision: string | null
  loraDir: string | null
  width: number
  height: number
  steps: number
  cfgScale: number
  sampler: string
  clipOnCpu: boolean
  vaeTiling: boolean
  flashAttention: boolean
  offloadToCpu: boolean
}

export const DEFAULT_IMAGE_CONFIG: ImageModelConfig = {
  mode: 'auto',
  vae: null,
  tae: null,
  clipL: null,
  clipG: null,
  t5xxl: null,
  llm: null,
  llmVision: null,
  loraDir: null,
  width: 1024,
  height: 1024,
  steps: 20,
  cfgScale: 7,
  sampler: 'euler',
  clipOnCpu: false,
  vaeTiling: false,
  flashAttention: false,
  offloadToCpu: false
}

export interface ImageCompanionRef {
  id: string
  name: string
  path: string
}

export interface ImageCompanions {
  vaes: ImageCompanionRef[]
  textEncoders: ImageCompanionRef[]
  projectors: ImageCompanionRef[]
  loras: ImageCompanionRef[]
}

export type ImageHostStatus = 'unloaded' | 'loading' | 'ready' | 'generating' | 'error'

export interface ImageProgress {
  stage: string
  detail: string
  completed: number | null
  total: number | null
  elapsedMs: number
}

export interface ImageHostState {
  status: ImageHostStatus
  residency: 'ephemeral' | 'resident'
  modelId: string | null
  modelName: string | null
  pid: number | null
  startedAt: number | null
  version: string | null
  args: string[]
  busyCount: number
  progress: ImageProgress | null
  error: string | null
  log: string[]
}

export interface ImageGenerateRequest {
  modelId?: string | null
  prompt: string
  negativePrompt?: string
  width?: number
  height?: number
  steps?: number
  cfgScale?: number
  seed?: number
  sampler?: string
  name?: string
  originTool?: string
  sessionId?: string
  contextTitle?: string
}

export interface ImageEditRequest extends ImageGenerateRequest {
  sourceAssetId: string
  maskAssetId?: string
}

export interface GeneratedImageResult {
  asset: AssetMeta
  seed: number | null
  width: number
  height: number
  modelId: string
  durationMs: number
}

export interface ImageHistoryEntry {
  id: string
  createdAt: number
  kind: 'generate' | 'edit'
  prompt: string
  negativePrompt?: string | null
  modelId: string
  modelName: string
  assetId: string
  sourceAssetId?: string | null
  width: number
  height: number
  steps: number
  cfgScale: number
  seed: number | null
  sampler?: string | null
  durationMs: number
  contextTitle?: string | null
  originTool?: string | null
}

export interface ImageContextSnippet {
  id: string
  label: string
  text: string
}

export interface ImagePromptContext {
  title: string
  subject?: string
  suggestedPrompt?: string
  snippets: ImageContextSnippet[]
}



export interface ModelInfo {
  kind: ModelKind
  architecture: string | null
  name: string | null
  sizeLabel: string | null
  author: string | null
  license: string | null
  contextLength: number | null
  layers: number | null
  embeddingLength: number | null
  chatTemplate: boolean
  imatrix: { dataset: string | null; chunks: number | null } | null
  experts: { count: number; used: number | null } | null
  mtpLayers: number | null
  slidingWindow: number | null
  quant: string | null
  split: { part: number; parts: number } | null
  sizeBytes: number | null
}

export interface HubModel {
  id: string
  downloads: number
  likes: number
  updatedAt: number | null
  params: number | null
  architecture: string | null
  contextLength: number | null
  gated: boolean
  family?: HubFamily
  pipelineTag?: string | null
}

export interface HubFile {
  file: string
  name: string
  fileBytes: number
}

export type DownloadState = 'queued' | 'downloading' | 'paused' | 'done' | 'failed'

export type CompanionRole = 'model' | 'vae' | 'tae' | 'clipL' | 'clipG' | 't5xxl' | 'llm' | 'llmVision' | 'lora' | 'other'

export interface DownloadBundleFile {
  repo: string
  file: string
  size?: number
  targetRel?: string
  role?: CompanionRole
}

export interface DownloadItem {
  id: string
  repo: string
  file: string
  name: string
  folder: string
  state: DownloadState
  received: number
  total: number
  speed: number
  secondsLeft: number | null
  error: string | null
  path: string | null
  startedAt: number
  files?: DownloadBundleFile[]
  imageConfig?: Partial<ImageModelConfig>
  targetModelId?: string
}

export interface ChatServerStatus {
  modelId: string
  modelName: string
  pid: number | null
  startedAt: number
  version: string
  args: string[]
  contextSize: number
  device: string | null
  offload: { gpu: number; total: number } | null
  mtp: boolean
  vision: boolean
  last: ServerTimings | null
  writing: boolean
  log: string[]
}

export interface MemoryServerStatus {
  modelId: string | null
  running: boolean
  pid: number | null
  error: string | null
  log: string[]
}

export interface NetworkSettings {
  port: number
  privateOnly: boolean
  maxFailures: number
  lockMinutes: number
  maxRequestMb: number
  pingSeconds: number
  idleMinutes: number
  maxMessageMb: number
  maxClients: number
  bufferSoftMb: number
  bufferHardMb: number
  reconnectMinSeconds: number
  reconnectMaxSeconds: number
  pairCodeSeconds: number
  pairCodeUses: number
  maxUploadMb: number
  uploadKeepMinutes: number
  uploadFolder: string
  announce: boolean
  announceType: string
  announceName: string
}

export interface NetworkClient {
  address: string
  lastAt: number
  requests: number
  failures: number
  lockedUntil: number
  model: string | null
}

export type DeviceLevelId = 'chat' | 'full' | 'admin'

export interface NetworkDevice {
  id: string
  name: string
  pairedAt: number
  lastSeen: number
  address: string | null
  connected: boolean
  level: DeviceLevelId
}

export interface PairingRequest {
  id: string
  name: string
  address: string
}

export interface PairingInfo {
  code: string
  expiresAt: number
  port: number
  addresses: string[]
  fingerprint: string
  id: string
}

export interface NetworkStatus {
  on: boolean
  listening: boolean
  announcing: boolean
  error: string | null
  addresses: string[]
  hasPassword: boolean
  passwordMin: number
  fingerprint: string | null
  settings: NetworkSettings
  clients: NetworkClient[]
  devices: NetworkDevice[]
  pairing: { open: boolean; request: PairingRequest | null }
}

export interface ServerStatus {
  build: ServerBuild | null
  logLines: number
  chat: ChatServerStatus | null
  memory: MemoryServerStatus
  vram: { used: number; total: number } | null
}

export type ParamGroup = 'load' | 'sampling'
export type ParamSection = 'memory' | 'context' | 'speed' | 'thinking' | 'sampling' | 'repetition' | 'vision' | 'files' | 'advanced'
export const THINKING_LEVELS = ['off', 'low', 'medium', 'high', 'max'] as const
export type ThinkingLevel = (typeof THINKING_LEVELS)[number]
export type ParamTarget = 'load' | 'context' | 'prompt'
export type ParamType = 'int' | 'float' | 'bool' | 'select' | 'text' | 'file' | 'files'
export type ModelTrait = 'moe' | 'dense' | 'mtp' | 'swa' | 'vision'
export type ModelTraitSet = Partial<Record<ModelTrait, boolean>>
export interface ParamWhen {
  key: string
  values?: (number | boolean | string)[]
}

export interface ParamDef {
  key: string
  label: string
  group: ParamGroup
  section: ParamSection
  more?: boolean
  flag?: string[]
  boolMap?: [string, string]
  target: ParamTarget
  type: ParamType
  default: number | boolean | string
  options?: string[]
  min?: number
  minNonZero?: number
  max?: number
  step?: number
  hint?: string
  needs?: { trait: ModelTrait; reason: string }
  when?: { any: ParamWhen[]; reason: string }
  emit?: 'on' | 'off' | 'both' | 'value'
  skip?: (number | boolean | string)[]
  files?: { name: string; extensions: string[] }
}

export type ParamValue = number | boolean | string
export type ModelConfig = Record<string, ParamValue>

export interface ModelHostState {
  status: ModelStatus
  modelId: string | null
  progress: number
  contextSize: number | null
  error: string | null
  restartNeeded: boolean
}

export interface ProjectorChoice {
  choice: string | null
  auto: boolean
  options: { id: string; name: string }[]
}

export interface PackSetting {
  key: string
  label: string
  value: ParamDef['default']
}

export interface PackView {
  id: string
  title: string
  for: string
  why: string
  source: string
  shipped: boolean
  file: string
  sets: PackSetting[]
  on: boolean
  failed: string[]
  invalid: string | null
  overridden: string[]
}

export interface PackValue {
  value: ParamDef['default']
  pack: string
  title: string
}

export interface PackListing {
  packs: PackView[]
  values: Record<string, PackValue>
  effective: ModelConfig
  folder: string
}

export interface ServerBuild {
  version: string
  label: string
  flags: string[] | null
}

export interface InstallRelease {
  tag: string
  name: string
  publishedAt: string | null
  url: string | null
}

export interface InstallChoice {
  build: string
  label: string
  size: number
  unavailable: string | null
  notes: string[]
  files: { name: string; size: number }[]
}

export interface InstallCheck {
  at: number
  ok: boolean
  version: string
  devices: string
  error: string | null
}

export interface InstallVersion {
  id: string
  tag: string | null
  build: string | null
  label: string
  folder: string
  external: boolean
  installedAt: number | null
  checksum: boolean | null
  check: InstallCheck | null
  inUse: string[]
}

export type InstallStage = 'resolve' | 'download' | 'checksum' | 'unpack' | 'verify' | 'done' | 'failed' | 'cancelled'

export const INSTALL_ENDS: InstallStage[] = ['done', 'failed', 'cancelled']

export function versionFolder(tag: string, build: string): string {
  return `${tag}-${build}`
}

export function installRunning(p: { stage: InstallStage } | null): boolean {
  return p !== null && !INSTALL_ENDS.includes(p.stage)
}

export interface InstallProgress {
  helper: string
  tag: string
  build: string
  stage: InstallStage
  received: number
  total: number
  file: string | null
  error: string | null
  version: string | null
}

export interface InstallHelperState {
  id: string
  title: string
  about: string
  source: string
  program: string
  root: string
  defaultRoot: string
  active: string | null
  versions: InstallVersion[]
  releases: InstallRelease[]
  checkedAt: number | null
  update: InstallRelease | null
  job: InstallProgress | null
  settings: Record<string, unknown>
  schema: ParamSchema
}

export type ChatTemplate = { type: 'auto' } | { type: 'jinja'; template: string }

export interface ModelConfigResult {
  config: ModelConfig
}

export const SAMPLING_KEYS = ['temperature', 'topP', 'topK', 'minP', 'repeatPenalty', 'maxTokens'] as const
export type SamplingKey = (typeof SAMPLING_KEYS)[number]
export type SamplingOverrides = Partial<Record<SamplingKey, number>>

export type ToolPermission = 'none' | 'ask' | 'always' | 'custom'

export type ModuleSource = 'builtin' | 'user'

export type ModuleKind = 'tools' | 'mcp'

export type ModuleState = 'on' | 'off' | 'needs-enabling' | 'changed' | 'error' | 'loading' | 'missing-dependency'

export interface ModuleSettingDef {
  name: string
  type: 'string' | 'number' | 'boolean' | 'folder'
  label: string
  description?: string
  default?: string | number | boolean
  secret?: boolean
}

export interface SkillInfo {
  name: string
  title: string
  description: string
  when: string
  updatedAt: number
}

export interface Toolset {
  id: string
  name: string
  description: string
  tools: string[]
}

export interface ToolParamDoc {
  name: string
  type: string
  required: boolean
  nullable: boolean
  description: string
  choices?: string[]
  variants?: string[]
  children?: ToolParamDoc[]
}

export interface ModuleCustomizationPatch {
  name?: string | null
  description?: string | null
  prompt?: string | null
  help?: string | null
  remind?: string | null
  toolDescriptions?: Record<string, string | null> | null
}

export interface ModuleToolInfo {
  name: string
  description: string
  defaultDescription?: string
  signature: string
  params: ToolParamDoc[]
  schema: Record<string, unknown>
  permission: ToolPermission
  defaultPermission?: ToolPermission
}

export interface ModuleActionDef {
  name: string
  label: string
  description?: string
}

export interface ModuleInfo {
  id: string
  name: string
  defaultName: string
  description: string
  defaultDescription: string
  prompt: string
  defaultPrompt: string
  help: string
  defaultHelp: string
  remind: string
  defaultRemind: string
  customized: boolean
  version: string
  kind: ModuleKind
  source: ModuleSource
  dir: string
  state: ModuleState
  error: string | null
  always: boolean
  needsWorkspace: boolean
  replacesBuiltin: boolean
  tools: ModuleToolInfo[]
  settings: ModuleSettingDef[]
  actions: ModuleActionDef[]
  panel: PanelTabInfo | null
  pages: PageTypeInfo[]
  values: Record<string, unknown>
  changedFiles: string[]
  dependencies: string[]
  missingDependencies: string[]
  adds: { label: string; items: string[] }[]
  mcp: { transport: string; target: string; status: string } | null
}

export interface ToolsPrefs {
  toolsFolder: string
  skillsFolder: string
  zipLimitMb: number
}

export type ToolChoiceMode = 'auto' | 'force_reason' | 'required' | 'none'
export const TOOL_CHOICE_MODES = ['auto', 'force_reason', 'required', 'none'] as const

export interface AgentProfile {
  id: string
  name: string
  description: string
  modelId: string | null
  systemPrompt: string
  sampling: SamplingOverrides
  workspace: string | null
  modules: string[]
  permissionMode: PermissionMode
  context: ContextSettings
  look: AgentLook
  toolsets?: string[]
  offTools?: string[]
  world?: WorldBinding | null
  folder?: string | null
  incognito?: boolean
  private?: boolean
  roleplay?: boolean
  library?: LibraryAccess
  theme?: string | null
  voice?: VoiceRef | null
  readAloud?: boolean
  reasoningStyle?: string | null
  thinking?: ThinkingLevel | null
  toolChoice?: ToolChoiceMode | null
  mindAuto?: { recall: boolean }
  remindEvery?: number
  maxToolRounds?: number
  sheet?: string | null
  sheets?: string[] | null
  player?: string | null
  relationships?: RelationshipEntry[]
  createdBy?: string | null
  createdAt: number
  updatedAt: number
}

export function chatPlayer(agent: { player?: string | null } | null | undefined, worldPlayer: string | null): string | null {
  return agent?.player || worldPlayer || null
}

export function agentSheets(agent: { sheet?: string | null; sheets?: string[] | null } | null | undefined): string[] {
  if (!agent) return []
  const list = Array.isArray(agent.sheets) ? agent.sheets.filter((x): x is string => typeof x === 'string' && x.length > 0) : []
  if (agent.sheet && !list.includes(agent.sheet)) {
    return [agent.sheet, ...list]
  }
  return list
}

export type AvatarRef = { kind: 'file'; assetId: string } | { kind: 'coded'; type: string } | { kind: 'avatar'; id: string }

export interface AgentLook {
  avatar: AvatarRef | null
  accent: string | null
  background: string | null
  tint: string | null
  tintStrength: number
  backgroundOpacity: number
}

export const DEFAULT_LOOK: AgentLook = { avatar: null, accent: null, background: null, tint: null, tintStrength: 0.15, backgroundOpacity: 0.3 }

export interface ContextSettings {
  outputShare: number
  trimAt: number
  keepTurns: number
  summaryAt: number
  autoSummary: boolean
}

export const DEFAULT_CONTEXT: ContextSettings = { outputShare: 0.12, trimAt: 0.6, keepTurns: 3, summaryAt: 0.8, autoSummary: false }

export interface SystemStats {
  cpu: number | null
  ramUsed: number
  ramTotal: number
  engineRss: number
  vramUsed: number | null
  vramTotal: number | null
}

export type AvatarState = MoodName

export const REACTIONS: Record<string, string> = {
  sweat_drop: '💧',
  lightbulb: '💡',
  sparks: '✨',
  heart: '❤️',
  question: '❓',
  exclaim: '❗',
  music: '🎵',
  sleepy: '💤',
  fire: '🔥',
  thumbs_up: '👍'
}

export interface AgentReaction {
  sessionId: string
  state: AvatarState | null
  reaction: string | null
  seconds: number
}

export interface ContextPrefs {
  memoryCap: number
  saveChatState: boolean
}

export interface ContextSummary {
  id: string
  upTo: string
  text: string
  turns: number
  createdAt: number
}

export interface TurnStats {
  promptTokens: number
  reusedTokens: number
  evaluatedTokens: number
  ttftMs: number | null
  inputTokens: number
  outputTokens: number
  genMs: number
  tokensPerSecond: number | null
  predictions?: { used: number; checked: number }
  contextUsed: number
  contextSize: number
  evalTokens?: number
  evalMs?: number
  genTokens?: number
  genPureMs?: number
  toolMs?: number
  waitMs?: number
  promptPerSecond?: number | null
}

export interface StatRecord {
  at: number
  modelId: string
  modelName: string
  contextSize: number
  gpuLayers: number | null
  sessionId: string
  evalTokens: number
  evalMs: number
  genTokens: number
  genMs: number
  toolMs: number
  ttftMs: number | null
  contextUsed: number
}

export interface ModelStats {
  modelId: string
  modelName: string
  contextSize: number
  gpuLayers: number | null
  turns: number
  genPerSecond: number | null
  promptPerSecond: number | null
  ttftMs: number | null
  toolShare: number | null
  lastAt: number
}

export interface StatsSummary {
  models: ModelStats[]
  recent: StatRecord[]
  host: { modelId: string | null; modelName: string | null; contextSize: number | null; gpuLayers: number | null; totalLayers: number | null }
}

export interface PromptCost {
  exact: boolean
  system: number
  tools: number
  total: number
  contextSize: number | null
  modules: Record<string, number>
}

export interface PromptSection {
  id: string
  sourceId: string
  label: string
  detail: string
  tokens: number
  text: string
  kind: 'instruction' | 'tool'
}

export interface PromptView {
  text: string
  tokens: number | null
  format: string
  note: string | null
  sections?: PromptSection[]
}

export interface ContextUsage {
  used: number
  size: number
  fixed: number
  history: number
  turn: number
  live: boolean
  at: number
}

export interface ServerTimings {
  promptTps: number | null
  genTps: number | null
  drafted: number | null
  accepted: number | null
}

export interface ServerFacts {
  tag: string | null
  mtp: boolean
  vision: boolean
  device: string | null
  offload: { gpu: number; total: number } | null
  last: ServerTimings | null
}

export interface ModelFacts {
  server?: ServerFacts
  wrapper: string
  contextSize: number
  trainContextSize: number
  swaSize: number | null
  needsCheckpoints: boolean
  checkpointMemory: number
}

export type AgentDraft = Omit<AgentProfile, 'id' | 'createdAt' | 'updatedAt' | 'context' | 'look'> & { id?: string; context?: Partial<ContextSettings>; look?: Partial<AgentLook> }

export interface SessionMeta {
  id: string
  title: string
  agentId: string
  incognito?: boolean
  permissionMode: PermissionMode | null
  reasoningStyle?: string | null
  thinking?: ThinkingLevel | null
  toolChoice?: ToolChoiceMode | null
  probe?: { subject: string; pageId: string } | null
  scene?: SessionSceneBinding | null
  dmMode?: boolean
  createdAt: number
  updatedAt: number
}

export type PermissionMode = 'ask' | 'auto-edit' | 'trusted'

export interface PermissionModeInfo {
  id: PermissionMode
  label: string
  description: string
}

export const PERMISSION_MODES: PermissionModeInfo[] = [
  { id: 'ask', label: 'Ask', description: 'Reading is free. Every edit and command asks you first.' },
  { id: 'auto-edit', label: 'Auto-edit', description: 'Edits in the workspace go ahead. Commands still ask.' },
  {
    id: 'trusted',
    label: 'Trusted',
    description: 'Edits and commands go ahead without asking. Deny rules and protected paths still apply.'
  }
]

export interface PermissionRules {
  allow: string[]
  deny: string[]
  protect: string[]
}

export interface ShellInfo {
  name: string
  path: string
  family: 'bash' | 'powershell'
}

export interface RewindPreview {
  files: string[]
  commands: number
  messagesRemoved: number
  text: string
}

export type ViewKind = 'thought' | 'text' | 'json' | 'files' | 'excerpt' | 'diff' | 'terminal' | 'collection' | 'note' | 'assets' | 'widget' | 'page' | 'present' | 'workout' | 'part' | 'entry'

export interface EntryViewData {
  kind: string
  id: string
  part: string
}

export type TurnPhaseKind = 'reading' | 'thinking' | 'writing' | 'calling' | 'tool' | 'waiting'

export interface TurnPhase {
  kind: TurnPhaseKind
  tool: string | null
  detail: string | null
  since: number
}

export type PresentWhere = 'inline' | 'panel' | 'stage' | 'board'

export interface PresentData {
  type: string
  fields: Record<string, unknown>
  where: PresentWhere
  key: string | null
  board?: string | null
}

export type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'select' | 'tags' | 'url' | 'asset'

export const FIELD_TYPES: FieldType[] = ['text', 'number', 'boolean', 'date', 'select', 'tags', 'url', 'asset']

export interface FieldDef {
  name: string
  type: FieldType
  options: string[]
  required: boolean
}

export type FieldValue = string | number | boolean | string[] | null

export type FieldChangeAction = 'add' | 'rename' | 'remove' | 'update'

export interface FieldChange {
  action: FieldChangeAction
  field: string
  newName?: string | null
  type?: FieldType | null
  options?: string[] | null
  required?: boolean | null
}

export interface CollectionRecord {
  id: string
  values: Record<string, FieldValue>
  createdAt: number
  updatedAt: number
}

export interface PageMeta {
  id: string
  title: string
  type: string | null
  image: string | null
  voice?: VoiceRef | null
  summary: string
  fields: FieldDef[]
  view: CollectionViewKind | null
  parent: string | null
  count: number
  size: number
  version: number
  createdAt: number
  updatedAt: number
}

export interface Page extends Omit<PageMeta, 'count' | 'summary' | 'size'> {
  body: string
  records: CollectionRecord[]
  data: unknown
}

export interface PageHit {
  id: string
  title: string
  snippet: string
}

export type AssetKind = 'image' | 'audio' | 'video' | 'pdf' | 'code' | 'text' | 'file'

export interface AssetMeta {
  id: string
  name: string
  file: string
  mime: string
  kind: AssetKind
  size: number
  source: { tool: string | null; sessionId: string | null; original: string | null }
  fingerprint?: string
  network?: boolean
  stored?: string
  parent?: string | null
  description?: string
  areas?: PictureArea[]
  createdAt: number
}

export interface LibraryImport {
  files: AssetMeta[]
  pages: { id: string; title: string }[]
  failed: { name: string; error: string }[]
}

export interface PictureArea {
  id: string
  name: string
  note: string
  x: number
  y: number
  w: number
  h: number
}

export type CollectionViewKind = 'table' | 'list' | 'checklist' | 'cards' | 'board' | 'calendar' | 'chart'

export const COLLECTION_VIEWS: CollectionViewKind[] = ['table', 'list', 'checklist', 'cards', 'board', 'calendar', 'chart']

export type ViewOptions = Record<string, unknown>

export interface CollectionViewData {
  collectionId: string
  view: CollectionViewKind
  recordIds: string[] | null
  options?: ViewOptions
}

export interface WidgetSource {
  kind: string
  [field: string]: unknown
}

export interface WidgetProviderInfo {
  kind: string
  label: string
  views: readonly string[]
  defaultView: string
  create: string | null
  choices: WidgetChoice[] | null
}

export interface WidgetChoice {
  id: string
  label: string
  module: string | null
}

export interface WidgetInfo {
  providers: WidgetProviderInfo[]
}

export interface WidgetLayout {
  x: number
  y: number
  w: number
  h: number
}

export interface Widget {
  id: string
  title: string
  source: WidgetSource
  view: string
  options: ViewOptions
  layout: WidgetLayout
}

export interface Dashboard {
  id: string
  name: string
  icon: string
  color: string | null
  order: number
  onToolbar: boolean
  widgets: Widget[]
  version: number
  createdAt: number
  updatedAt: number
}

export interface NoteViewData {
  noteId: string
}

export interface WidgetViewData {
  dashboardId: string
  widgetId: string
}

export interface PageViewData {
  assetId: string
}

export interface AssetsViewData {
  assetIds: string[]
}

export interface ViewRef {
  kind: ViewKind
  title?: string
  data: unknown
}

export interface FileListItem {
  path: string
  type: 'file' | 'dir'
  size?: number
}

export interface ExcerptData {
  path: string
  startLine: number
  endLine: number
  totalLines: number
  text: string
}

export interface DiffData {
  path: string
  patch: string
  created: boolean
}

export interface TerminalData {
  command: string
  shell: string
  output: string
  exitCode: number | null
  timedOut: boolean
  assetIds?: string[]
}

export type UiRequestKind = 'question' | 'confirm' | 'approval' | 'form' | 'unlock' | 'gather' | 'decide' | 'rolled' | 'opposed'
export type UiRequestStatus = 'pending' | 'answered' | 'cancelled' | 'expired'

export interface CommandArg {
  name: string
  label?: string
  hint?: string
  default?: string
}

export interface CommandInfo {
  name: string
  summary: string
  usage: string
  needsChat: boolean
  prompt?: string
  args?: CommandArg[]
}

export interface CommandResult {
  text: string | null
  openSession: string | null
}

export interface GatherSourceInfo {
  kind: string
  label: string
  icon: string
}

export interface GatherProps {
  purpose: string
  wants: string | null
  sources: GatherSourceInfo[]
}

export interface GatherItem {
  source: string
  title: string
  data: Record<string, unknown>
}

export interface GatherAnswer {
  items: GatherItem[]
  declined: string | null
}

export interface QuestionProps {
  question: string
  options: string[]
  multiSelect: boolean
  allowOther: boolean
}

export interface QuestionAnswer {
  choices: string[]
  other: string | null
}

export interface UnlockProps {
  reason: string
}

export interface VaultStatus {
  configured: boolean
  unlocked: boolean
}

export interface ConfirmProps {
  message: string
  confirmLabel: string
  cancelLabel: string
}

export interface FormField {
  name: string
  label: string
  type: 'string' | 'number' | 'integer' | 'boolean' | 'choice'
  choices?: string[]
  required: boolean
  description?: string
  default?: string | number | boolean
}

export interface FormProps {
  title: string
  message: string
  fields: FormField[]
}

export interface FormAnswer {
  action: 'accept' | 'decline' | 'cancel'
  values: Record<string, string | number | boolean>
}

export type ApprovalAction = 'edit' | 'write' | 'command' | 'remember' | 'tool'

export interface ApprovalProps {
  action: ApprovalAction
  title: string
  reason: string
  path: string | null
  command: string | null
  shell: string | null
  patch: string | null
  sessionLabel: string | null
  details?: string | null
}

export interface ApprovalAnswer {
  decision: 'once' | 'session' | 'deny'
  note: string | null
}

export interface UiRequestState {
  id: string
  kind: UiRequestKind
  props: QuestionProps | ConfirmProps | ApprovalProps | FormProps | UnlockProps | GatherProps | PickDecisionProps | RolledDecisionProps | OpposedProps
  status: UiRequestStatus
  answer?: unknown
}

export type ToolStatus = 'running' | 'done' | 'error' | 'cancelled' | 'blocked'

export interface ToolPart {
  type: 'tool'
  id: string
  name: string
  args: Record<string, unknown>
  status: ToolStatus
  startedAt: number
  durationMs?: number
  result?: string
  view?: ViewRef
  error?: string
  ui?: UiRequestState
  cut?: boolean
  trimmed?: number
  edited?: boolean
  images?: string[]
}

export type TextPart = { type: 'text'; text: string }
export type ThoughtPart = { type: 'thought'; text: string }
export type ChatPart = TextPart | ThoughtPart | ToolPart

export type MessageStatus = 'running' | 'complete' | 'aborted' | 'error'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  parts: ChatPart[]
  createdAt: number
  status: MessageStatus
  error?: string
  historyIndex?: number
  stats?: TurnStats
  notice?: string
  attachments?: string[]
  elements?: ChatElement[]
  edited?: boolean
}

export interface SessionSnapshot {
  meta: SessionMeta
  messages: ChatMessage[]
  running: boolean
  usage: ContextUsage | null
  instructionsChanged: boolean
  summaries: ContextSummary[]
  compacting: boolean
  todos: TodoList | null
}

export type EngineState = 'starting' | 'ready' | 'crashed'

export interface EngineStatus {
  state: EngineState
  restarts: number
}

export type ViewId = string

export interface ScreenPoint {
  x: number
  y: number
}

export type SideTab = string

export interface PanelTabInfo {
  label: string
  icon: string
}

const PAGE_KIND_ALIASES: Record<string, string> = {
  'cards:card': 'card',
  'cards:deck': 'deck',
  'cards:layout': 'card_layout',
  'cards:set': 'card_set'
}

const PAGE_TYPE_FROM_KIND: Record<string, string> = Object.fromEntries(
  Object.entries(PAGE_KIND_ALIASES).map(([type, kind]) => [kind, type])
)

export function pageKindOf(type: string | null | undefined): string {
  if (!type) return 'page'
  return PAGE_KIND_ALIASES[type] ?? type.replace(':', '.')
}

export function pageTypeOfKind(kind: string): string {
  return PAGE_TYPE_FROM_KIND[kind] ?? kind.replace('.', ':')
}

export function isPageTypeKind(kind: string): boolean {
  return kind in PAGE_TYPE_FROM_KIND || kind.includes('.')
}

export interface PageTypeInfo {
  type: string
  label: string
  plural: string
  description: string
  icon: string
  view: string
  widget: string | null
  parts: Record<string, string>
  single: boolean
  panel: boolean
  group: string | null
  rollable: boolean
  actions: string[]
}

export interface PanelItem {
  id: string
  key: string | null
  tab: string
  module: string
  view: ViewRef
  createdAt: number
  updatedAt: number
}

export interface SidePanelPrefs {
  open: boolean
  width: number
  tab: SideTab
}

export interface ChatListPrefs {
  open: boolean
  width: number
  closed?: string[]
  shown?: string[]
}

export interface Backdrop {
  colors: string[]
  image: string | null
  slideshow: string | null
  dim: number
}

export interface ChatBackdrops {
  chat: Backdrop | null
  timed: { backdrop: Backdrop; until: number } | null
}

export function cleanBackdrop(value: unknown): Backdrop | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<Backdrop>
  const colors = (Array.isArray(v.colors) ? v.colors : []).filter((c): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c)).slice(0, 4)
  const image = isAssetId(v.image) ? v.image : null
  const slideshow = typeof v.slideshow === 'string' && /^[\w.-]{1,200}$/.test(v.slideshow) ? v.slideshow : null
  if (!colors.length && !image && !slideshow) return null
  const dim = typeof v.dim === 'number' && Number.isFinite(v.dim) ? Math.min(0.9, Math.max(0, v.dim)) : image || slideshow ? 0.55 : 0
  return { colors, image, slideshow, dim }
}

export type AvatarSize = 'small' | 'medium' | 'large' | 'xl'

export interface VoiceRef {
  id: string
  rate: number
  pitch: number
}

export function cleanVoice(value: unknown): VoiceRef | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<VoiceRef>
  if (typeof v.id !== 'string' || !/^(system|piper):.{1,200}$/.test(v.id)) return null
  const num = (x: unknown, lo: number, hi: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : 1)
  return { id: v.id, rate: num(v.rate, 0.5, 2), pitch: num(v.pitch, 0.5, 2) }
}

export interface SceneActor {
  name: string
  agentId: string | null
  image: string | null
  voice: VoiceRef | null
}

export interface SceneBeat {
  do: 'enter' | 'exit' | 'say' | 'act' | 'narrate' | 'show' | 'cue' | 'wait'
  who: string | null
  text: string | null
  mood: string | null
  view: ViewRef | null
  sound: string | null
  flash: string | null
  shake: boolean
  seconds: number | null
}

export interface SceneFields {
  title: string
  beats: SceneBeat[]
  cast: Record<string, SceneActor>
  narrator: { agentId: string | null; voice: VoiceRef | null }
}

export interface VoicePrefs {
  on: boolean
  fallback: VoiceRef | null
  piperPath: string
  piperVoices: string
}

export interface AudioPrefs {
  music: boolean
  sounds: boolean
  volume: number
}

export interface TrayPin {
  kind: string
  id: string | null
  label: string
  icon: string
}

export interface DropPrefs {
  ask: boolean
  folder: string
}

export interface Settings {
  backdrop: Backdrop | null
  chatBackdrop: Backdrop | null
  defaultTheme: string
  audio: AudioPrefs
  voice: VoicePrefs
  avatarSize: AvatarSize
  sidePanel: SidePanelPrefs
  chatList: ChatListPrefs
  dataList: ChatListPrefs
  pagesList: ChatListPrefs
  pagesWidth: number
  chatPictureHeight: number
  trayKinds: string[]
  trayTabs: string[]
  trayPins: TrayPin[]
  favourites: TrayPin[]
  modelFolders: string[]
  ambientBackground: boolean
  lastView: ViewId
  startWithWindows: boolean
  droppedPictures: DropPrefs
  problems: ProblemPrefs
  portability: PortabilityPrefs
}

export interface AppInfo {
  version: string
  dataDir: string
  platform: string
  vaultMissing: string | null
}

export interface VaultEntry {
  name: string
  path: string
  exists: boolean
  current: boolean
}

export interface VaultList {
  list: VaultEntry[]
  pinnedBy: string | null
}

export interface MindPrefs {
  embeddingModelId: string | null
}

export interface Memory {
  id: string
  text: string
  pinned: boolean
  by: 'agent' | 'user' | 'auto'
  sessionId: string | null
  createdAt: number
  updatedAt: number
}

export interface Thought {
  id: string
  at: number
  sessionId: string | null
  kind: 'think' | 'reason'
  style: string | null
  question: string
  reasoning: string
  conclusion: string
}

export interface JournalTool {
  name: string
  args: Record<string, unknown>
  result: string
}

export interface JournalEntry {
  id: string
  at: number
  sessionId: string
  sessionTitle: string
  user: string
  reply: string
  thoughts: string
  tools: JournalTool[]
  status: MessageStatus
}

export interface MindHit {
  id: string
  source: 'memory' | 'journal' | 'relationship'
  ref: string
  at: number
  text: string
  score: number
  similarity: number | null
}

export interface MindOverview {
  agentId: string
  memories: number
  pinned: number
  thoughts: number
  journal: number
  chunks: number
  indexed: number
  firstAt: number | null
}

export interface MindIndexing {
  agentId: string
  done: number
  total: number
}

export interface StyleVoice {
  label: string
  line: string
}

export interface RepoEntry {
  id: string
  title: string
  tags: string[]
  scope: 'use' | 'run'
  values: string[]
  updatedAt: number
}

export interface CharacterMind {
  reasoningStyle?: string | null
  howItThinks?: string
  voiceConstraints?: string
  forceReason?: boolean
  memories?: StoryMemory[]
}

export interface CharacterSheet {
  id: string
  title: string
  fields: string[]
  values: Record<string, string>
  dnd: DndStats | null
  game?: EntityRecord | null
  gameRules?: string
  faction?: string | null
  save?: string
  story: Story
  mind?: CharacterMind | null
  relationships?: RelationshipEntry[]
  image: string | null
  updatedAt: number
}

export interface CustomCommand {
  id: string
  name: string
  summary: string
  prompt: string
  args?: CommandArg[]
  updatedAt: number
}

export interface ReasoningStyle {
  id: string
  name: string
  instruction: string
  voices: StyleVoice[]
  constraints?: string
  updatedAt: number
}

export type TodoStatus = 'pending' | 'doing' | 'done'

export interface TodoItem {
  id: string
  task: string
  status: TodoStatus
}

export interface TodoList {
  items: TodoItem[]
  updatedAt: number
  editedByUser: boolean
}

export interface ChatSearchHit {
  sessionId: string
  title: string
  agentId: string
  messageId: string | null
  role: 'user' | 'assistant' | null
  at: number
  snippet: string
  matches: number
}

export interface MemorySearchHit {
  agentId: string
  source: MindHit['source']
  ref: string
  at: number
  snippet: string
  similarity: number | null
}

export type FolderAccess = 'read' | 'write'

export interface LinkedFolder {
  id: string
  name: string
  path: string
  access: FolderAccess
  exclude: string[]
  agents: string[]
}

export type ReminderRepeat = 'none' | 'hourly' | 'daily' | 'weekdays' | 'weekly'

export interface Reminder {
  id: string
  agentId: string
  sessionId: string | null
  kind: 'remind' | 'run'
  text: string
  repeat: ReminderRepeat
  next: number
  enabled: boolean
  createdAt: number
  lastFiredAt: number | null
}

export interface ReminderFired {
  id: string
  agentId: string
  kind: Reminder['kind']
  text: string | null
  late: boolean
  sessionId: string | null
}

export interface WebLogEntry {
  at: number
  agentId: string | null
  sessionId: string
  kind: 'search' | 'read'
  target: string
  outcome: 'allowed' | 'auto' | 'denied' | 'blocked' | 'failed'
  note?: string
}

export interface WorkoutNote {
  title: string
  text: string
}

export interface ExerciseData {
  how: string[]
  dos: string[]
  donts: string[]
  easier: string
  figures: string[]
  video: string | null
  unit: string
  muscles: string[]
}

export interface WorkoutItem {
  exercise: string
  sets: number
  min: number
  max: number
}

export interface WorkoutData {
  items: WorkoutItem[]
  before: WorkoutNote[]
  after: WorkoutNote[]
}

export interface WorkoutLogRow {
  date: string
  exercise: string
  workout: string | null
  values: number[]
}

export interface WorkoutExercise extends ExerciseData {
  id: string
  name: string
  image: string | null
  sets: number
  min: number
  max: number
}

export interface WorkoutDay {
  id: string
  label: string
  before: WorkoutNote[]
  exercises: WorkoutExercise[]
  after: WorkoutNote[]
}

export interface WorkoutSession {
  date: string
  workout: string | null
  label: string
  rows: { exercise: string; name: string; unit: string; values: number[] }[]
}

export interface WorkoutOverview {
  workouts: WorkoutDay[]
  last: Record<string, { date: string; values: number[] }>
  history: WorkoutSession[]
  today: string
}

export interface WorkoutHistory {
  rows: WorkoutLogRow[]
  exercises: { id: string; name: string; unit: string; muscles: string[] }[]
  workouts: { id: string; name: string }[]
  targets: Record<string, Record<string, WorkoutTarget>>
}

export interface WorkoutTarget {
  sets: number
  min: number
  max: number
}

export type WorkoutPageType = 'exercise' | 'workout'

export interface PartViewData {
  kind: string
  id: string
  part: string
  text: string | null
}

export interface WorkoutViewData {
  mode: 'workout' | 'history'
  workout: string | null
}

export interface EntryPreview {
  kind: string
  label: string
  icon: string
  id: string
  title: string
  line?: string
  card: string
  image: string | null
  fields?: { name: string; text: string }[]
}

export interface LibraryHit {
  kind: string
  id: string
  title: string
  summary: string
  excerpt?: string
  at?: number
  tags?: string[]
}

export const hitDetail = (h: LibraryHit): string => h.excerpt || h.summary

export interface KindLinkActionInfo {
  name: string
  label: string
  detail: string
  mode: 'insert' | 'placeholder'
}

export interface KindFlags {
  exportable: boolean
  importable: boolean
  removable: boolean
  renamable: boolean
  carriable: boolean
  preferBundle: boolean
  bundleNote: string | null
  boardable: boolean
  family: string | null
}

export interface LibrarySection extends KindFlags {
  kind: string
  label: string
  plural: string
  icon: string
  description: string
  count: number
  entries: LibraryHit[]
  group: string
}

export interface KindInfo extends KindFlags {
  kind: string
  label: string
  plural: string
  icon: string
  description: string
  count: number
  parts: string[]
  actions: string[]
  source: string | null
  agents: boolean
}

export type ChatAccess = 'none' | 'own' | 'all'

export interface LibraryAccess {
  hidden: string[]
  chats: ChatAccess
}

export const DEFAULT_LIBRARY_ACCESS: LibraryAccess = { hidden: [], chats: 'own' }

export type StoryAction = 'pause' | 'resume' | 'complete' | 'abandon'

export interface StorySummary {
  id: string
  template: string
  status: 'active' | 'paused' | 'completed' | 'abandoned'
  act: number
  turn: number
  note: string | null
  at: number
}

export interface PythonRun {
  at: number
  exit: number | null
  output: string
  files: string[]
}

export interface PythonScript {
  id: string
  name: string
  description: string
  code: string
  runs: PythonRun[]
  createdAt: number
  updatedAt: number
}

export type PlayerAction = 'play' | 'queue' | 'pause' | 'resume' | 'next' | 'previous' | 'stop'

export interface PlayerCommand {
  action: PlayerAction
  assetIds: string[]
}

export interface PlayerTrack {
  id: string
  name: string
}

export interface PlayerState {
  playing: boolean
  index: number
  queue: PlayerTrack[]
}

export interface UserIdentity {
  name: string
  about: string
}

export interface PendingRequest {
  id: string
  sessionId: string
  kind: UiRequestKind
  label: string
  tool: string
  at: number
}

export interface BoardMessage {
  id: string
  agentId: string | null
  author: string
  text: string
  at: number
  editedAt: number | null
}

export interface AttributionEntry {
  id: string
  name: string
  category: string
  license: string
  url?: string
  usedFor: string
  attribution?: string
  source?: string
  moduleId?: string
}

export interface ResolvedAttribution extends AttributionEntry {
  moduleName?: string
  moduleDisabled?: boolean
}

export interface BundledTileset {
  asset: AssetMeta
  name: string
  tile: { w: number; h: number }
  columns: number
  count: number
  margin: number
  spacing: number
}
