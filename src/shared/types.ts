import { isAssetId } from './ids'
import type { DndStats } from './dnd'
import type { Story } from './story'
import type { WorldBinding } from './world'
import type { CardSource } from './cardDecks'
import type { PickDecisionProps } from './pickDecision'
import type { RolledDecisionProps } from './rolledDecision'
import type { OpposedProps } from './opposedCheck'
export type ModelStatus = 'unloaded' | 'loading' | 'ready' | 'error'

export type RemoteApi = 'openai' | 'anthropic'

export interface RemoteSpec {
  api: RemoteApi
  baseUrl: string | null
  model: string
  hasKey: boolean
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
  chat: { label: 'Chat', plural: 'Chat', runnable: true, always: true, listed: true, note: null },
  embedding: { label: 'Embedding', plural: 'Embedding', runnable: true, always: true, listed: true, note: null },
  projector: { label: 'Vision adapter', plural: 'Vision adapters', runnable: false, always: false, listed: false, note: 'A vision adapter goes with a model; it is not a model of its own.' },
  imatrix: {
    label: 'Importance matrix',
    plural: 'Importance matrices',
    runnable: false,
    always: false,
    listed: false,
    note: 'An importance matrix is only used when a model is quantized. It is not a model, and running a model never reads it: a model made with one has it built in.'
  },
  other: { label: 'Other', plural: 'Other', runnable: true, always: false, listed: true, note: null }
} as const

export type ModelKind = keyof typeof MODEL_KINDS



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
}

export interface HubFile {
  file: string
  name: string
  fileBytes: number
}

export type DownloadState = 'queued' | 'downloading' | 'paused' | 'done' | 'failed'

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
}

export type ParamGroup = 'load' | 'sampling'
export type ParamSection = 'memory' | 'context' | 'speed' | 'thinking' | 'sampling' | 'repetition' | 'advanced'
export const THINKING_LEVELS = ['off', 'low', 'medium', 'high', 'max'] as const
export type ThinkingLevel = (typeof THINKING_LEVELS)[number]
export type ParamTarget = 'load' | 'context' | 'prompt'
export type ParamType = 'int' | 'float' | 'bool' | 'select'

export interface ParamDef {
  key: string
  label: string
  group: ParamGroup
  section: ParamSection
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
}

export type ParamValue = number | boolean | string
export type ModelConfig = Record<string, ParamValue>

export interface ModelHostState {
  status: ModelStatus
  modelId: string | null
  progress: number
  contextSize: number | null
  error: string | null
}

export type GpuBackend = 'auto' | 'cuda' | 'vulkan' | 'cpu'

export interface GpuInfo {
  choice: GpuBackend
  active: string | null
  note: string | null
  cudaDownload: number | null
}

export interface CudaInstallProgress {
  stage: 'download' | 'extract' | 'done'
  received: number
  total: number
}

export type ChatTemplate = { type: 'auto' } | { type: 'wrapper'; name: string } | { type: 'jinja'; template: string }

export interface ModelFixInfo {
  id: string
  label: string
  models: string
  description: string
  on: boolean
}

export interface ChatTemplateInfo {
  choice: ChatTemplate
  wrappers: string[]
}

export interface ModelConfigResult {
  config: ModelConfig
  reloadRequired: boolean
}

export const SAMPLING_KEYS = ['temperature', 'topP', 'topK', 'minP', 'repeatPenalty', 'maxTokens'] as const
export type SamplingKey = (typeof SAMPLING_KEYS)[number]
export type SamplingOverrides = Partial<Record<SamplingKey, number>>

export type ToolPermission = 'none' | 'ask' | 'always' | 'custom'

export type ModuleSource = 'builtin' | 'user'

export type ModuleKind = 'tools' | 'mcp'

export type ModuleState = 'on' | 'off' | 'needs-enabling' | 'changed' | 'error' | 'loading'

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

export interface ModuleToolInfo {
  name: string
  description: string
  permission: ToolPermission
}

export interface ModuleActionDef {
  name: string
  label: string
  description?: string
}

export interface ModuleInfo {
  id: string
  name: string
  description: string
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
  mcp: { transport: string; target: string; status: string } | null
}

export interface ToolsPrefs {
  toolsFolder: string
  skillsFolder: string
}

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
  mindAuto?: { recall: boolean }
  remindEvery?: number
  sheet?: string | null
  player?: string | null
  cards?: CardSource | null
  createdBy?: string | null
  createdAt: number
  updatedAt: number
}

export type AvatarRef = { kind: 'file'; assetId: string } | { kind: 'coded'; type: string }

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

export type AvatarState = 'idle' | 'thinking' | 'talking' | 'laughing' | 'happy' | 'sad' | 'angry' | 'error'

export const AVATAR_STATES: AvatarState[] = ['idle', 'thinking', 'talking', 'laughing', 'happy', 'sad', 'angry', 'error']

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

export const CODED_AVATARS: { id: string; label: string }[] = [
  { id: 'ascii_face', label: 'ASCII face' },
  { id: 'glitch_skull', label: 'Glitch skull' },
  { id: 'ascii_hd', label: 'ASCII skull (animated)' }
]

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

export interface PromptView {
  text: string
  tokens: number | null
  format: string
  note: string | null
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

export interface ModelFacts {
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
  probe?: { subject: string; pageId: string } | null
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

export interface CommandInfo {
  name: string
  summary: string
  usage: string
  needsChat: boolean
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

export type OverlayMode = 'button' | 'toolbar' | 'panel'
export type OverlayPanel = 'chat' | 'dashboard'

export interface OverlayState {
  mode: OverlayMode
  panel: OverlayPanel | null
  anchor: { right: boolean; bottom: boolean }
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

export function pageKindOf(type: string | null | undefined): string {
  return type ? type.replace(':', '.') : 'page'
}

export function pageTypeOfKind(kind: string): string {
  return kind.replace('.', ':')
}

export function isPageTypeKind(kind: string): boolean {
  return kind.includes('.')
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

export type AvatarSize = 'small' | 'medium' | 'large'

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
  pagesWidth: number
  chatPictureHeight: number
  trayKinds: string[]
  trayTabs: string[]
  trayPins: TrayPin[]
  favourites: TrayPin[]
  modelFolders: string[]
  ambientBackground: boolean
  lastView: ViewId
  overlayEnabled: boolean
  hotkey: string
  overlayPosition: ScreenPoint | null
  startWithWindows: boolean
  droppedPictures: DropPrefs
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
  source: 'memory' | 'journal'
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

export interface CharacterSheet {
  id: string
  title: string
  fields: string[]
  values: Record<string, string>
  dnd: DndStats | null
  story: Story
  image: string | null
  updatedAt: number
}

export interface CustomCommand {
  id: string
  name: string
  summary: string
  prompt: string
  updatedAt: number
}

export interface ReasoningStyle {
  id: string
  name: string
  instruction: string
  voices: StyleVoice[]
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
  card: string
  image: string | null
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

export interface KindFlags {
  exportable: boolean
  removable: boolean
  renamable: boolean
  carriable: boolean
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
