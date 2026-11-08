import type { CarryMode, CarryOpened, CarrySource, CarrySummary } from './carry'
import type { DndStats } from './dnd'
import type { ExportChoice, ExportInfo } from './exporting'
import type { Slideshow, SlideshowData } from './slideshow'
import type { Story } from './story'
import type { Routine, RoutineDraft } from './routines'
import type { TimelineRow } from './timeline'
import type { WorldChanges, WorldEntity, WorldMeta, WorldPost, WorldSchema } from './world'
import type { JourneyEntry, JourneyKind, MapData, MapListing, PlaceVisitor, WorldMapUse } from './maps'
import type { Action, ActionResult } from './actions'
import type { Decision } from './decisions'
import type { CardSwap, DeckRef } from './cardDecks'
import type { Ambience, AmbienceCue, Theme } from './theme'
import type {
  KindInfo,
  PlayerCommand,
  PlayerState,
  CommandInfo,
  UserIdentity,
  PendingRequest,
  CommandResult,
  AgentReaction,
  PythonScript,
  VoiceRef,
  StoryAction,
  StorySummary,
  LibraryHit,
  PictureArea,
  LibraryImport,
  EntryPreview,
  LibrarySection,
  ModuleInfo,
  ToolsPrefs,
  WidgetInfo,
  SystemStats,
  ContextPrefs,
  AgentDraft,
  PanelItem,
  Backdrop,
  Toolset,
  SkillInfo,
  StatsSummary,
  ChatBackdrops,
  TurnPhase,
  PromptCost,
  AssetMeta,
  CollectionRecord,
  CollectionViewKind,
  Page,
  PageHit,
  PageMeta,
  WorkoutHistory, WorkoutOverview,
  BoardMessage,
  WorkoutPageType,
  Dashboard,
  ContextUsage,
  PromptView,
  ServerInfo,
  ServerStatus,
  NetworkSettings,
  NetworkStatus,
  ServerInstallProgress,
  ServerRelease,
  ProjectorChoice,
  ModelFacts,
  OverlayMode,
  OverlayPanel,
  OverlayState,
  WidgetLayout,
  WidgetSource,
  ViewOptions,
  FieldChange,
  FieldDef,
  FieldValue,
  AgentProfile,
  AppInfo,
  VaultList,
  ChatMessage,
  EngineStatus,
  ModelConfig,
  ModelConfigResult,
  CustomCommand,
  CharacterSheet,
  RepoEntry,
  ChatTemplate,
  ModelEntry,
  ModelKind,
  HubModel,
  HubFile,
  ModelInfo,
  DownloadItem,
  ThinkingLevel,
  RemoteApi,
  ModelHostState,
  ParamDef,
  SessionMeta,
  SessionSnapshot,
  PermissionMode,
  PermissionRules,
  RewindPreview,
  Settings,
  ShellInfo,
  ToolPart,
  VaultStatus,
  MindOverview,
  Memory,
  Thought,
  JournalEntry,
  MindHit,
  MindPrefs,
  MindIndexing,
  ReasoningStyle,
  TodoItem,
  TodoList,
  ChatSearchHit,
  MemorySearchHit,
  LinkedFolder,
  Reminder,
  ReminderFired,
  WebLogEntry
} from './types'
import type { CompendiumEntry, CompendiumKind, CompendiumRef } from './compendium'
import type { CatalogData, GameDef } from './game/defs/defs'
import type { RuleSet } from './game/defs/ruleSets'
import type { EntityRecord } from './game/core/GameEntity'
import type { ClockState } from './game/core/clock'
import type { GameSave, SaveMeta, WorldSaves } from './game/save'
import type { StoredDecision } from './storedDecision'
import type { StoredAction } from './storedAction'

type Req<P, R> = { params: P; result: R }

export interface EngineRequests {
  ping: Req<void, { pid: number; at: number }>
  crash: Req<void, boolean>
  'models.list': Req<void, ModelEntry[]>
  'models.scan': Req<{ folders: string[] }, ModelEntry[]>
  'hub.search': Req<{ query: string }, HubModel[]>
  'hub.files': Req<{ repo: string }, HubFile[]>
  'hub.fileInfo': Req<{ repo: string; file: string }, ModelInfo>
  'hub.repoFacts': Req<{ repo: string; updatedAt: number | null }, ModelInfo | null>
  'hub.token.has': Req<void, boolean>
  'hub.token.set': Req<{ token: string | null }, boolean>
  'downloads.list': Req<void, DownloadItem[]>
  'downloads.start': Req<{ repo: string; file: string; name: string; folder: string; total: number }, DownloadItem[]>
  'downloads.pause': Req<{ id: string }, DownloadItem[]>
  'downloads.resume': Req<{ id: string }, DownloadItem[]>
  'downloads.cancel': Req<{ id: string }, DownloadItem[]>
  'downloads.clear': Req<void, DownloadItem[]>
  'models.add': Req<{ path: string }, ModelEntry>
  'models.remote.save': Req<{ id: string | null; name: string; api: RemoteApi; baseUrl: string | null; model: string; key: string | null; contextSize: number | null }, ModelEntry>
  'models.remote.test': Req<{ id: string }, string>
  'models.remove': Req<{ id: string }, boolean>
  'models.state': Req<void, ModelHostState>
  'models.load': Req<{ id: string }, ModelHostState>
  'models.fillInfo': Req<void, void>
  'models.unload': Req<void, ModelHostState>
  'models.favourite': Req<{ id: string; on: boolean }, ModelEntry[]>
  'models.kind': Req<{ id: string; kind: ModelKind | null }, ModelEntry[]>
  'system.stats': Req<void, SystemStats>
  'models.params': Req<void, ParamDef[]>
  'models.config.get': Req<{ id: string }, ModelConfig>
  'models.config.set': Req<{ id: string; patch: ModelConfig }, ModelConfigResult>
  'models.config.reset': Req<{ id: string }, ModelConfigResult>
  'models.server.get': Req<void, ServerInfo>
  'models.server.release': Req<void, ServerRelease>
  'models.server.install': Req<void, ServerInfo>
  'models.projector.get': Req<{ id: string }, ProjectorChoice>
  'models.projector.set': Req<{ id: string; projector: string | null }, ProjectorChoice>
  'models.template.get': Req<{ id: string }, ChatTemplate>
  'models.template.set': Req<{ id: string; choice: ChatTemplate }, ChatTemplate>
  'agents.list': Req<void, AgentProfile[]>
  'agents.get': Req<{ id: string }, AgentProfile>
  'agents.save': Req<AgentDraft, AgentProfile>
  'agents.delete': Req<{ id: string; folder: 'keep' | 'delete' }, boolean>
  'sessions.list': Req<void, SessionMeta[]>
  'sessions.create': Req<{ agentId: string }, SessionMeta>
  'sessions.open': Req<{ id: string }, SessionSnapshot>
  'sessions.send': Req<{ id: string; text: string; attachments?: string[] }, { userMessageId: string; assistantMessageId: string }>
  'sessions.abort': Req<{ id: string }, boolean>
  'sessions.rename': Req<{ id: string; title: string }, SessionMeta>
  'sessions.delete': Req<{ id: string }, boolean>
  'ui.respond': Req<{ id: string; value: unknown }, boolean>
  'vault.setKey': Req<{ key: string | null }, VaultStatus>
  'vault.status': Req<void, VaultStatus>
  'vault.migrate': Req<void, { sealed: number; removed: number }>
  'data.check': Req<void, { checked: number; sealed: number; plain: number; failed: { file: string; error: string }[] }>
  'mind.overview': Req<{ agentId: string }, MindOverview>
  'mind.memories': Req<{ agentId: string }, Memory[]>
  'mind.remember': Req<{ agentId: string; id: string | null; text: string; pinned: boolean }, Memory>
  'mind.forget': Req<{ agentId: string; id: string }, boolean>
  'mind.thoughts': Req<{ agentId: string; month: string | null }, { months: string[]; month: string | null; thoughts: Thought[] }>
  'mind.forgetThought': Req<{ agentId: string; id: string }, boolean>
  'mind.forgetJournal': Req<{ agentId: string; id: string }, boolean>
  'mind.journal': Req<{ agentId: string; month: string | null }, { months: string[]; month: string | null; entries: JournalEntry[] }>
  'mind.search': Req<{ agentId: string; query: string; limit?: number }, MindHit[]>
  'mind.prefs.get': Req<void, MindPrefs & { loaded: boolean; error: string | null }>
  'mind.prefs.set': Req<Partial<MindPrefs>, MindPrefs & { loaded: boolean; error: string | null }>
  'styles.list': Req<void, ReasoningStyle[]>
  'commands.custom.list': Req<void, CustomCommand[]>
  'commands.custom.save': Req<{ id: string | null; name: string; summary: string; prompt: string }, CustomCommand>
  'commands.custom.delete': Req<{ id: string }, boolean>
  'styles.save': Req<{ id: string | null; name: string; instruction: string; voices: { label: string; line: string }[] }, ReasoningStyle>
  'styles.delete': Req<{ id: string }, boolean>
  'sessions.refreshInstructions': Req<{ id: string }, boolean>
  'sessions.context': Req<{ id: string }, { usage: ContextUsage | null; instructionsChanged: boolean }>
  'agents.contextUsage': Req<{ agentId: string }, ContextUsage | null>
  'sessions.prompt': Req<{ id: string | null; agentId: string }, PromptView>
  'agents.promptCost': Req<{ draft: AgentDraft }, PromptCost>
  'weblog.list': Req<void, WebLogEntry[]>
  'modules.pageView': Req<{ pageId: string; part: string | null }, { html: string; values: unknown; module: string } | null>
  'modules.pageAction': Req<{ pageId: string; name: string; payload: unknown }, { message: string | null }>
  'skills.list': Req<void, SkillInfo[]>
  'skills.read': Req<{ name: string }, string>
  'skills.write': Req<{ name: string; text: string }, SkillInfo>
  'skills.delete': Req<{ name: string }, boolean>
  'skills.template': Req<void, string>
  'toolsets.list': Req<void, Toolset[]>
  'toolsets.save': Req<Partial<Toolset> & { name: string }, Toolset>
  'toolsets.delete': Req<{ id: string }, Toolset[]>
  'worlds.list': Req<void, WorldMeta[]>
  'worlds.create': Req<{ name: string; schema?: WorldSchema | null }, WorldMeta>
  'worlds.rename': Req<{ id: string; name: string }, WorldMeta>
  'worlds.delete': Req<{ id: string }, boolean>
  'worlds.schema': Req<{ id: string }, WorldSchema>
  'worlds.saveSchema': Req<{ id: string; schema: WorldSchema }, WorldMeta>
  'worlds.records': Req<{ id: string; type: string; layer?: 'template' | 'play' }, Record<string, WorldEntity>>
  'worlds.changes': Req<{ id: string; type: string; layer?: 'template' | 'play' }, Record<string, WorldChanges>>
  'maps.list': Req<void, MapListing[]>
  'worlds.setPlayer': Req<{ id: string; sheet: string | null }, WorldMeta>
  'worlds.setRules': Req<{ id: string; rules: string }, WorldMeta>
  'worlds.setTags': Req<{ id: string; tags: string[] }, WorldMeta>
  'actions.roll': Req<{ action: Action; character: string | null; pick?: number | null; world?: string | null; deck?: DeckRef | null }, ActionResult>
  'decisions.roll': Req<{ decision: Decision }, Decision>
  'decks.find': Req<{ ref: DeckRef; make?: boolean }, { deck: string | null; set: string | null }>
  'decks.take': Req<{ ref: DeckRef; card: string }, { deck: string }>
  'decks.add': Req<{ ref: DeckRef; card: string; by: number }, { deck: string }>
  'decks.swap': Req<{ ref: DeckRef; swap: CardSwap }, { deck: string }>
  'decks.addSet': Req<{ ref: DeckRef; set: string }, { deck: string }>
  'worlds.journey': Req<{ id: string; sheet: string }, JourneyEntry[]>
  'worlds.addJourney': Req<{ id: string; sheet: string; kind: JourneyKind; text: string }, JourneyEntry>
  'places.visitors': Req<{ sheets: string[] }, PlaceVisitor[]>
  'maps.get': Req<{ id: string }, MapData | null>
  'maps.withPlace': Req<{ world: string; place: string }, { map: MapData; use: WorldMapUse } | null>
  'places.here': Req<{ world: string }, Record<string, PlaceVisitor[]>>
  'maps.create': Req<{ name: string }, MapData>
  'maps.save': Req<{ map: MapData }, MapData>
  'maps.import': Req<{ path: string; map: string | null }, MapData>
  'worlds.maps': Req<{ id: string }, WorldMapUse[]>
  'worlds.useMap': Req<{ id: string; map: string }, WorldMapUse[]>
  'worlds.dropMap': Req<{ id: string; map: string }, WorldMapUse[]>
  'worlds.saveMapUse': Req<{ id: string; use: WorldMapUse }, WorldMapUse>
  'maps.readers': Req<void, { label: string; extensions: string[] }[]>
  'worlds.put': Req<{ id: string; type: string; key: string; entity: WorldEntity }, boolean>
  'worlds.remove': Req<{ id: string; type: string; key: string }, boolean>
  'worlds.board': Req<{ id: string }, WorldPost[]>
  'worlds.post': Req<{ id: string; author: string; to: string; message: string }, WorldPost>
  'worlds.editPost': Req<{ id: string; index: number; message: string | null }, WorldPost[]>
  'stats.summary': Req<void, StatsSummary>
  'stats.clear': Req<void, void>
  'server.status': Req<void, ServerStatus>
  'server.stop': Req<void, ModelHostState>
  'server.restart': Req<void, ModelHostState>
  'network.set': Req<{ on?: boolean; settings?: Partial<NetworkSettings> }, NetworkStatus>
  'network.password.suggest': Req<void, string>
  'network.password.set': Req<{ password: string }, NetworkStatus>
  'network.certificate.get': Req<void, string | null>
  'network.certificate.renew': Req<void, NetworkStatus>
  'network.unlock': Req<{ address: string }, NetworkStatus>
  'backdrop.get': Req<{ sessionId: string }, ChatBackdrops>
  'themes.list': Req<void, Theme[]>
  'themes.save': Req<Omit<Partial<Theme>, 'id'> & { id: string | null }, Theme>
  'themes.delete': Req<{ id: string }, boolean>
  'ambience.get': Req<{ sessionId: string }, Ambience>
  'ambience.set': Req<{ sessionId: string; ambience: Partial<Ambience> | null; minutes: number | null }, Ambience>
  'backdrop.set': Req<{ sessionId: string; scope: 'chat' | 'timed'; backdrop: Backdrop | null; minutes?: number }, ChatBackdrops>
  'panel.list': Req<{ sessionId: string }, PanelItem[]>
  'panel.showEntry': Req<{ sessionId: string; entry: string; part: string | null }, string>
  'panel.remove': Req<{ sessionId: string; id: string }, boolean>
  'panel.clear': Req<{ sessionId: string; tab: string }, boolean>
  'reminders.list': Req<void, Reminder[]>
  'reminders.cancel': Req<{ id: string }, Reminder[]>
  'reminders.enable': Req<{ id: string; on: boolean }, Reminder[]>
  'reminders.snooze': Req<{ id: string; minutes: number }, Reminder[]>
  'folders.list': Req<void, LinkedFolder[]>
  'folders.save': Req<Partial<LinkedFolder> & { path: string }, LinkedFolder[]>
  'folders.delete': Req<{ id: string }, LinkedFolder[]>
  'search.chats': Req<{ query: string }, { chats: ChatSearchHit[]; locked: boolean }>
  'search.memory': Req<{ query: string }, { memory: MemorySearchHit[]; locked: boolean }>
  'todos.set': Req<{ sessionId: string; items: TodoItem[] }, TodoList>
  'sessions.compact': Req<{ id: string }, { turns: number }>
  'player.report': Req<PlayerState, boolean>
  'commands.list': Req<{ sessionId: string | null; agentId: string }, CommandInfo[]>
  'user.get': Req<void, UserIdentity>
  'ui.pending': Req<void, PendingRequest[]>
  'user.set': Req<UserIdentity, UserIdentity>
  'places.get': Req<void, Record<string, unknown>>
  'places.set': Req<{ key: string; value: unknown }, void>
  'commands.run': Req<{ sessionId: string | null; agentId: string; line: string }, CommandResult>
  'tools.list': Req<void, ModuleInfo[]>
  'tools.enable': Req<{ id: string }, ModuleInfo[]>
  'tools.disable': Req<{ id: string }, ModuleInfo[]>
  'tools.reload': Req<{ id: string }, ModuleInfo[]>
  'tools.settings': Req<{ id: string; values: Record<string, unknown> }, ModuleInfo[]>
  'tools.create': Req<{ id: string; name: string; kind: 'tools' | 'mcp' }, ModuleInfo[]>
  'tools.importMcp': Req<{ json: string }, { created: string[]; skipped: string[] }>
  'tools.action': Req<{ id: string; name: string }, { message: string | null }>
  'tools.prefs.get': Req<void, ToolsPrefs>
  'tools.prefs.set': Req<Partial<ToolsPrefs>, ToolsPrefs>
  'contextPrefs.get': Req<void, ContextPrefs>
  'contextPrefs.set': Req<Partial<ContextPrefs>, ContextPrefs>
  'sessions.setMode': Req<{ id: string; mode: PermissionMode | null }, SessionMeta>
  'sessions.rewindPreview': Req<{ id: string; messageId: string }, RewindPreview>
  'sessions.rewind': Req<{ id: string; messageId: string }, { text: string; restored: string[] }>
  'sessions.fork': Req<{ id: string; messageId: string }, { session: SessionMeta; text: string }>
  'sessions.setStyle': Req<{ id: string; style: string | null }, SessionMeta>
  'sessions.setThinking': Req<{ id: string; thinking: ThinkingLevel | null }, SessionMeta>
  'sessions.editResult': Req<{ id: string; messageId: string; partId: string; text: string }, ToolPart>
  'sessions.editReply': Req<{ id: string; messageId: string; edits: { index: number; text: string }[] }, ChatMessage>
  'permissions.get': Req<void, PermissionRules>
  'permissions.set': Req<PermissionRules, PermissionRules>
  'permissions.defaults': Req<void, PermissionRules>
  'shell.info': Req<void, ShellInfo | null>
  'models.facts': Req<void, ModelFacts | null>
  'board.list': Req<void, BoardMessage[]>
  'dnd.list': Req<{ kind: CompendiumKind }, CompendiumRef[]>
  'dnd.get': Req<{ kind: CompendiumKind; id: string }, { entry: CompendiumEntry; srd: boolean; own: boolean }>
  'dnd.save': Req<{ kind: CompendiumKind; entry: CompendiumEntry; previousId: string | null }, CompendiumEntry>
  'dnd.remove': Req<{ kind: CompendiumKind; id: string }, boolean>
  'game.ruleSets': Req<void, RuleSet[]>
  'game.saveRuleSet': Req<{ id: string | null; name: string; notes: string; copy: string | null }, RuleSet>
  'game.removeRuleSet': Req<{ id: string }, boolean>
  'game.list': Req<{ ruleSet: string; type: string }, GameDef[]>
  'game.get': Req<{ ruleSet: string; type: string; id: string }, GameDef>
  'game.save': Req<{ ruleSet: string; type: string; def: GameDef; previousId: string | null }, GameDef>
  'game.remove': Req<{ ruleSet: string; type: string; id: string }, boolean>
  'game.catalog': Req<{ ruleSet: string }, CatalogData>
  'game.joinCharacter': Req<{ sheet: string; ruleSet: string; template: string }, EntityRecord>
  'game.saveCharacter': Req<{ sheet: string; record: EntityRecord }, EntityRecord>
  'game.leaveCharacter': Req<{ sheet: string }, boolean>
  'game.tickCharacters': Req<{ sheets: string[]; seconds: number }, number>
  'saves.list': Req<{ world: string }, WorldSaves>
  'saves.all': Req<void, SaveMeta[]>
  'saves.get': Req<{ id: string }, GameSave>
  'saves.current': Req<{ world: string }, GameSave>
  'saves.create': Req<{ world: string; name: string; copy: boolean }, GameSave>
  'saves.select': Req<{ world: string; id: string }, GameSave>
  'saves.rename': Req<{ id: string; name: string }, GameSave>
  'saves.remove': Req<{ id: string }, boolean>
  'saves.bring': Req<{ id: string; sheet: string }, GameSave>
  'saves.takeOut': Req<{ sheet: string }, GameSave | null>
  'saves.adopt': Req<{ world: string }, GameSave>
  'saves.travel': Req<{ sheet: string; id: string; map: string; place: string }, GameSave>
  'game.misfits': Req<{ sheet: string }, string[]>
  'game.giveItem': Req<{ sheet: string; item: string; count: number; gold: number }, { given: number; gold: number }>
  'game.useAbility': Req<{ sheet: string; ability: string; target: string | null; at: { x: number; y: number } | null; distance: number }, string>
  'saves.markUsed': Req<{ id: string; trigger: string; flag: string }, GameSave>
  'saves.setFlag': Req<{ id: string; flag: string }, GameSave>
  'saves.writeClock': Req<{ id: string; clockId: string; clock: ClockState }, GameSave>
  'decisions.get': Req<{ id: string }, StoredDecision>
  'decisions.save': Req<{ decision: StoredDecision; previousId: string | null }, StoredDecision>
  'storyActions.get': Req<{ id: string }, StoredAction>
  'storyActions.list': Req<Record<string, never>, StoredAction[]>
  'decisions.list': Req<Record<string, never>, StoredDecision[]>
  'storyActions.save': Req<{ action: StoredAction; previousId: string | null }, StoredAction>
  'dnd.import': Req<{ kind: CompendiumKind; json: string; apply: boolean }, { added: string[]; replaced: string[] }>
  'board.add': Req<{ text: string }, BoardMessage>
  'board.update': Req<{ id: string; text: string }, BoardMessage>
  'board.remove': Req<{ id: string }, boolean>
  'workout.overview': Req<void, WorkoutOverview>
  'workout.history': Req<void, WorkoutHistory>
  'workout.log': Req<{ workout: string; date: string; sets: Record<string, number[]> }, string>
  'workout.deleteSession': Req<{ date: string; workout: string | null }, boolean>
  'workout.setLog': Req<{ date: string; exercise: string; workout: string | null; values: number[] }, boolean>
  'workout.deleteDay': Req<{ date: string }, boolean>
  'workout.patchExercise': Req<{ id: string; unit?: string; muscles?: string[] }, boolean>
  'workout.logExercise': Req<{ date: string; exercise: string; workout: string | null; values: number[] }, string>
  'workout.save': Req<{ type: WorkoutPageType; id: string | null; title: string | null; data: unknown }, PageMeta>
  'workout.saveWorkouts': Req<{ json: string }, string[]>
  'workout.workoutsFormat': Req<void, string>
  'workout.saveExercises': Req<{ json: string }, { added: string[]; existing: string[] }>
  'workout.exercisesFormat': Req<void, string>
  'python.scripts': Req<void, PythonScript[]>
  'stories.list': Req<void, StorySummary[]>
  'stories.act': Req<{ id: string; action: StoryAction; note: string | null }, StorySummary>
  'stories.delete': Req<{ id: string }, boolean>
  'python.save': Req<{ id: string | null; name: string; code: string; description: string }, PythonScript>
  'python.delete': Req<{ id: string }, boolean>
  'python.run': Req<{ id: string }, PythonScript>
  'library.read': Req<{ entry: string }, string>
  'library.find': Req<{ query: string; kind: string | null }, LibraryHit[]>
  'library.overview': Req<{ query: string; perKind: number; kind?: string | null; kinds?: string[]; skip?: string[] }, LibrarySection[]>
  'timeline.recent': Req<{ limit: number }, TimelineRow[]>
  'routines.list': Req<void, Routine[]>
  'routines.save': Req<RoutineDraft, Routine>
  'routines.enable': Req<{ id: string; on: boolean }, Routine[]>
  'routines.run': Req<{ id: string }, boolean>
  'library.kinds': Req<void, { kind: string; label: string; description: string; short: string; rollable: boolean; parts: { name: string; description: string }[] }[]>
  'library.kindInfo': Req<void, KindInfo[]>
  'library.reindex': Req<void, boolean>
  'library.guides': Req<void, { id: string; title: string; summary: string }[]>
  'library.rename': Req<{ entry: string; name: string }, string>
  'slideshows.save': Req<{ id: string | null; title: string; data: SlideshowData }, Slideshow>
  'carry.save': Req<{ entry: string | null; text: string | null; picture: string; lock: boolean; path: string }, void>
  'carry.peek': Req<{ sources: CarrySource[] }, CarrySummary[]>
  'carry.open': Req<{ source: CarrySource; mode: CarryMode }, CarryOpened>
  'sheets.list': Req<void, CharacterSheet[]>
  'sheets.get': Req<{ id: string }, CharacterSheet>
  'repos.list': Req<void, RepoEntry[]>
  'repos.get': Req<{ id: string }, RepoEntry>
  'repos.save': Req<{ id: string | null; title: string; tags: string[]; scope: 'use' | 'run'; values: string[] }, RepoEntry>
  'sheets.save': Req<{ id: string | null; title: string; fields: string[]; values: Record<string, string>; dnd?: DndStats | null; story?: Story }, CharacterSheet>
  'library.rollText': Req<{ text: string }, { text: string; rolled: { token: string; value: string; error?: string }[] }>
  'library.remove': Req<{ entry: string }, boolean>
  'library.clearKind': Req<{ kind: string }, { removed: number; failed: number }>
  'tags.set': Req<{ entry: string; tags: string[] }, string[]>
  'tags.of': Req<{ entry: string }, string[]>
  'tags.list': Req<{ kind: string | null }, { tag: string; count: number }[]>
  'tags.map': Req<void, Record<string, string[]>>
  'library.resolve': Req<{ entry: string }, { kind: string; id: string }>
  'library.preview': Req<{ entry: string }, EntryPreview>
  'library.fields': Req<{ entry: string }, string[]>
  'library.inside': Req<{ entry: string }, { segment: string; kind: string; title: string }[]>
  'library.field': Req<{ entry: string; field: string }, string | null>
  'library.drawable': Req<Record<string, never>, LibraryHit[]>
  'library.draw': Req<{ entry: string; count: number }, string[]>
  'export.describe': Req<{ source: string; args: Record<string, string>; options: Record<string, string> }, ExportInfo>
  'export.build': Req<ExportChoice, { title: string; text: string }>
  'library.exportFolder': Req<{ entries: string[]; kind: string | null; tag: string | null; target: 'obsidian' | 'markdown'; dir: string }, { folder: string; files: number; attachments: number; skipped: string[] }>
  'data.pages.list': Req<void, PageMeta[]>
  'data.pages.get': Req<{ id: string }, Page>
  'data.pages.create': Req<{ title: string; body: string; fields: FieldDef[]; type: string | null; parent?: string | null }, Page>
  'data.pages.write': Req<{ id: string; title: string | null; body: string | null }, Page>
  'data.pages.append': Req<{ ref: string; text: string }, Page>
  'data.pages.view': Req<{ id: string; view: CollectionViewKind | null }, Page>
  'data.pages.image': Req<{ id: string; image: string | null }, Page>
  'data.pages.voice': Req<{ id: string; voice: VoiceRef | null }, Page>
  'tts.piperVoices': Req<{ folder: string }, { name: string; file: string }[]>
  'tts.piper': Req<{ exe: string; folder: string; voice: string; text: string; rate: number }, string>
  'data.pages.fields': Req<{ id: string; changes: FieldChange[] }, Page>
  'data.pages.delete': Req<{ id: string }, boolean>
  'data.pages.move': Req<{ id: string; parent: string | null }, Page>
  'data.pages.search': Req<{ query: string }, PageHit[]>
  'data.pages.backlinks': Req<{ id: string }, { id: string; title: string }[]>
  'data.records.add': Req<{ pageId: string; values: Record<string, FieldValue>; at: number | null }, CollectionRecord>
  'data.records.update': Req<{ pageId: string; recordId: string; values: Record<string, FieldValue> }, CollectionRecord>
  'data.records.move': Req<{ pageId: string; recordId: string; to: number }, boolean>
  'data.records.delete': Req<{ pageId: string; recordIds: string[] }, string[]>
  'data.assets.list': Req<void, AssetMeta[]>
  'data.assets.get': Req<{ id: string }, AssetMeta>
  'data.assets.import': Req<{ paths: string[]; parent?: string | null }, AssetMeta[]>
  'data.pages.makeFolders': Req<{ path: string }, string | null>
  'data.assets.delete': Req<{ id: string }, boolean>
  'data.assets.move': Req<{ id: string; parent: string | null }, AssetMeta>
  'data.assets.path': Req<{ id: string }, string>
  'dashboards.list': Req<void, Dashboard[]>
  'dashboards.home': Req<void, Dashboard>
  'dashboards.create': Req<{ name: string; icon: string | null; onToolbar: boolean }, Dashboard>
  'dashboards.update': Req<{ id: string; name?: string | null; icon?: string | null; color?: string | null; onToolbar?: boolean | null }, Dashboard>
  'dashboards.delete': Req<{ id: string }, boolean>
  'dashboards.reorder': Req<{ ids: string[] }, Dashboard[]>
  'widgets.add': Req<{ dashboardId: string; title: string | null; source: WidgetSource; view: string | null; options: ViewOptions | null }, Dashboard>
  'widgets.update': Req<{ dashboardId: string; widgetId: string; title?: string | null; view?: string | null; options?: ViewOptions | null; source?: WidgetSource | null }, Dashboard>
  'widgets.remove': Req<{ dashboardId: string; widgetId: string }, Dashboard>
  'widgets.place': Req<{ dashboardId: string; things: string[]; at: { x: number; y: number } | null }, Dashboard>
  'widgets.create': Req<{ dashboardId: string; kind: string }, Dashboard>
  'widgets.info': Req<void, WidgetInfo>
  'data.assets.importBytes': Req<{ name: string; base64: string }, AssetMeta>
  'data.assets.setNetwork': Req<{ id: string; on: boolean }, AssetMeta>
  'data.import': Req<{ paths: string[]; parent: string | null }, LibraryImport>
  'data.assets.describe': Req<{ id: string; description: string; areas: PictureArea[] }, AssetMeta>
  'widgets.layout': Req<{ dashboardId: string; layouts: (WidgetLayout & { id: string })[] }, Dashboard>
  'dev.simulateTools': Req<{ sessionId: string; prompt: string; calls: { name: string; args: Record<string, unknown> }[] }, boolean>
}

export type EngineRequestName = keyof EngineRequests
export type EngineParams<K extends EngineRequestName> = EngineRequests[K]['params']
export type EngineResult<K extends EngineRequestName> = EngineRequests[K]['result']

export const ERROR_MARKER = '__sevenError'

export type CodedErrorWire = { [ERROR_MARKER]: { code: string; message: string } }

export const LONG_REQUESTS: ReadonlySet<EngineRequestName> = new Set<EngineRequestName>([
  'models.load',
  'models.remote.test',
  'models.server.release',
  'models.server.install',
  'models.fillInfo',
  'vault.migrate',
  'mind.search',
  'data.check',
  'search.memory',
  'models.scan',
  'hub.search',
  'hub.files',
  'hub.fileInfo',
  'hub.repoFacts',
  'sessions.send',
  'commands.run',
  'dev.simulateTools',
  'tools.enable',
  'tools.reload',
  'tools.settings',
  'tools.create',
  'tools.importMcp',
  'tools.prefs.set',
  'tools.action'
])

export interface MainRequests {
  'window.minimize': Req<void, void>
  'window.toggleMaximize': Req<void, boolean>
  'window.close': Req<void, void>
  'window.isMaximized': Req<void, boolean>
  'dialog.openFolder': Req<void, string | null>
  'dialog.openModelFile': Req<void, string | null>
  'dialog.openFiles': Req<void, string[]>
  'dialog.openFile': Req<{ filters: { name: string; extensions: string[] }[] }, string | null>
  'assets.readImage': Req<{ id: string }, { bytes: Uint8Array<ArrayBuffer>; mime: string } | null>
  'asset.open': Req<{ id: string; reveal: boolean }, void>
  'clipboard.write': Req<{ text: string }, void>
  'asset.saveAs': Req<{ id: string; name: string }, string | null>
  'dialog.saveText': Req<{ name: string; text: string }, string | null>
  'dialog.savePath': Req<{ name: string }, string | null>
  'data.backup': Req<void, { path: string; files: number; bytes: number } | null>
  'data.pickBackup': Req<void, { path: string; createdAt: number; encrypted: boolean } | null>
  'vaults.list': Req<void, VaultList>
  'vaults.create': Req<{ name: string; path: string }, VaultList>
  'vaults.add': Req<{ name: string; path: string }, VaultList>
  'vaults.rename': Req<{ path: string; name: string }, VaultList>
  'vaults.remove': Req<{ path: string }, VaultList>
  'vaults.switch': Req<{ path: string }, void>
  'vaults.restore': Req<{ source: string; name: string; path: string }, VaultList>
  'data.clearAll': Req<{ keepSettings: boolean }, void>
  'folder.open': Req<{ path: string }, void>
  'present.page': Req<{ html: string }, string>
  'settings.get': Req<void, Settings>
  'overlay.resetPosition': Req<void, void>
  'vault.status': Req<void, VaultStatus>
  'vault.setup': Req<{ passphrase: string }, VaultStatus>
  'vault.unlock': Req<{ passphrase: string }, VaultStatus>
  'vault.lock': Req<void, VaultStatus>
  'settings.set': Req<Partial<Settings>, Settings>
  'app.info': Req<void, AppInfo>
  'app.show': Req<{ sessionId: string | null }, void>
  'app.quit': Req<void, void>
  'engine.status': Req<void, EngineStatus>
  'overlay.isExpanded': Req<void, boolean>
  'overlay.state': Req<void, OverlayState>
  'overlay.setMode': Req<{ mode: OverlayMode; panel?: OverlayPanel | null; items?: number; focus?: boolean }, OverlayState>
  'overlay.setExpanded': Req<{ expanded: boolean; focus: boolean }, boolean>
  'overlay.dragStart': Req<void, void>
  'overlay.dragEnd': Req<void, void>
  'hotkey.set': Req<{ accelerator: string }, { ok: boolean; error: string | null }>
}

export type MainRequestName = keyof MainRequests
export type MainParams<K extends MainRequestName> = MainRequests[K]['params']
export type MainResult<K extends MainRequestName> = MainRequests[K]['result']

export interface Events {
  'engine.status': EngineStatus
  'vault.changed': VaultStatus
  'mind.changed': { agentId: string }
  'folders.changed': LinkedFolder[]
  'reminders.changed': Reminder[]
  'timeline.changed': null
  'routines.changed': Routine[]
  'reminder.fired': ReminderFired
  'todos.changed': { sessionId: string; list: TodoList }
  'module.view': { id: string }
  'toolsets.changed': { list: Toolset[] }
  'worlds.changed': { id: string }
  'maps.changed': { id: string }
  'backdrop.changed': { sessionId: string; state: ChatBackdrops }
  'backdrop.app': { backdrop: Backdrop | null }
  'panel.changed': { sessionId: string; items: PanelItem[] }
  'mind.indexing': MindIndexing
  'styles.changed': ReasoningStyle[]
  'commands.changed': CustomCommand[]
  'player.command': PlayerCommand
  'tags.changed': Record<string, never>
  'browser.open': { url: string | null }
  'browser.status': { text: string }
  'model.state': ModelHostState
  'server.install': ServerInstallProgress
  'network.changed': NetworkStatus
  'engine.children': { pids: number[] }
  'engine.restart': null
  'models.changed': ModelEntry[]
  'downloads.changed': DownloadItem[]
  'agents.changed': AgentProfile[]
  'sessions.changed': SessionMeta[]
  'session.rewritten': { sessionId: string }
  'turn.start': { sessionId: string; userMessage: ChatMessage; assistantMessage: ChatMessage }
  'text.delta': { sessionId: string; messageId: string; text: string }
  'thought.delta': { sessionId: string; messageId: string; text: string }
  'turn.finish': { sessionId: string; message: ChatMessage }
  'message.part': { sessionId: string; messageId: string; part: ToolPart }
  'turn.phase': { sessionId: string; messageId: string; phase: TurnPhase }
  'tool.draft': { sessionId: string; messageId: string; callIndex: number; name: string; chunk: string; done: boolean }
  'tool.output': { sessionId: string; messageId: string; partId: string; chunk: string }
  'ui.notify': { sessionId: string; title: string; message: string }
  'ui.pending': PendingRequest[]
  'engine.error': { sessionId: string | null; message: string }
  'window.maximized': boolean
  'settings.changed': Settings
  'overlay.expanded': boolean
  'overlay.state': OverlayState
  'app.focusSession': { sessionId: string }
  'page.changed': { id: string; meta: PageMeta | null }
  'workout.changed': Record<string, never>
  'board.changed': Record<string, never>
  'dnd.changed': Record<string, never>
  'game.changed': Record<string, never>
  'saves.changed': { world: string }
  'decisions.changed': Record<string, never>
  'storyActions.changed': Record<string, never>
  'themes.changed': Theme[]
  'ambience.changed': { sessionId: string; ambience: Ambience }
  'ambience.cue': AmbienceCue
  'python.changed': Record<string, never>
  'stories.changed': Record<string, never>
  'asset.changed': { id: string; meta: AssetMeta | null }
  'dashboard.changed': { id: string; dashboard: Dashboard | null }
  'context.usage': { sessionId: string; usage: ContextUsage }
  'context.compacting': { sessionId: string; active: boolean }
  'tools.changed': ModuleInfo[]
  'agent.reaction': AgentReaction
  'context.compacted': { sessionId: string; trimmed: number; summarised: number }
}

export type EventName = keyof Events
export type EventMessage = { [K in EventName]: { event: K; payload: Events[K] } }[EventName]

export const Channel = {
  engine: 'seven:engine',
  main: 'seven:main',
  event: 'seven:event'
} as const

export type EngineWireRequest = { id: number; name: EngineRequestName; params: unknown }
export type EngineWireResponse = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string; code?: string }
export type EngineWireMessage = EngineWireResponse | EventMessage

export interface SevenApi {
  engine<K extends EngineRequestName>(name: K, params: EngineParams<K>): Promise<EngineResult<K>>
  main<K extends MainRequestName>(name: K, params: MainParams<K>): Promise<MainResult<K>>
  on<K extends EventName>(event: K, callback: (payload: Events[K]) => void): () => void
  pathForFile(file: File): string
}
