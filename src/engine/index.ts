import { toId } from '@shared/ids'
import { cleanElements } from '@shared/chatElements'
import { allRepos, getRepo, saveRepo } from './library/repos'
import { guideModules, guideText, moduleGuidePreview } from './chat/context'
import { identity } from './user/identity'
import { places } from './user/places'
import { HUB_TOKEN, hubFileInfo, hubFiles, hubRepoFacts, searchHub } from './model/hub'
import { downloads } from './model/downloads'
import { serviceKeys } from './model/keys'
import { getSheet, saveSheet, setSheetFaction, sheetIds } from './library/sheets'
import { customCommands } from './commands/custom'
import type { EngineRequestName, EngineRequests, EngineWireRequest, Events } from '@shared/protocol'
import type { AgentProfile } from '@shared/types'
import { ModelRegistry } from './model/registry'
import { ModelHost } from './model/host'
import { llamaLimits, serverBuild, serverDevices } from './model/server/install'
import { Packs } from './packs'
import { appFolder, machineRoot } from './install/paths'
import { PARAMS } from './model/params'
import { modelTraitSet } from '@shared/modelParams'
import { ModelRoutes } from './model/server/modelRoutes'
import { memoryServer } from './mind/embedder'
import { AgentRegistry } from './agents/registry'
import { SessionStore } from './sessions/store'
import { ChatRunner } from './chat/runner'
import { UiRequests } from './ui/requests'
import { DEFAULT_RULES, PermissionStore } from './permissions/rules'
import { CheckpointStore } from './checkpoints/store'
import { detectShell } from './tools/shell'
import { data } from './data/hub'
import { importToLibrary } from './data/importing'
import { EXERCISES_FORMAT, WORKOUTS_FORMAT, workout } from './workout/store'
import { createSlideshow, saveSlideshow } from './library/slideshows'
import { registerWorkoutExport } from './workout/export'
import { buildExport, describeExport } from './exporting/registry'
import { registerEntryExports } from './exporting/entry'
import { scripts } from './python/scripts'
import { themes } from './themes/store'
import { avatars } from './avatars/store'
import { storyRuns } from './stories'
import { piperSpeak, piperVoices } from './tts'
import './sources/builtin'
import { LLAMA_SERVER } from './install/helpers/llamaServer'
import { installEvents } from './install/events'
import { installState, freeSpace } from './install/state'
import { refreshReleases, choiceViews } from './install/releases'
import { install, cancelJob } from './install/job'
import { activate, addExisting, onActivated, removeVersion, verifyVersion } from './install/versions'
import { change as changeInstall } from './install/store'
import { setupCommands } from './commands/builtin'
import { commandInfo, commandsFor, runCommand } from './commands/registry'
import type { Ambience, AmbienceCue, Theme } from '@shared/theme'
import type { Avatar } from '@shared/avatars'
import { tags as tagStore } from './library/tags'
import { setGuideSource, specialPages, USER, allKinds, clearKind, kindInfo, removeEntry, renameEntry, rollText, drawEntry, drawableEntries, previewEntry, find as libraryFind, overview as libraryOverview, resolveEntry, partView, timelineRows, describeEvent, resolveRoutineEntry, entryInside } from './library/kinds'
import { contextPrefs } from './chat/prefs'
import { modules } from './modules/registry'
import { setAgentAccess } from './agents/access'
import { setToolsFolderCheck } from './tools/workspace'
import { setPrivateKey, vaultEvents } from './util/secure'
import { clearIndexes } from './util/dirIndex'
import { checkFiles, migrate, vaultStatus } from './vault'
import { minds } from './mind/store'
import { endLeftovers, reportChildren } from './model/server/children'
import { styles } from './mind/styles'
import { setupReasoner } from './mind/reason'
import { setupProbe } from './probe/probe'
import { player } from './player'
import { setSessionAccess } from './sessions/access'
import { ChatSearch } from './search'
import { linkedFolders } from './folders/store'
import { reminders } from './reminders/store'
import { exportToFolder } from './library/folderExport'
import { apiProbe, apiTest, listRemoteModels } from './model/apiChat'
import { timeline } from './timeline/store'
import { routines } from './routines/store'
import { observeData } from './timeline/record'
import { WEB_LOG } from './weblog'
import { readLines } from './util/fs'
import type { WebLogEntry } from '@shared/types'
import type { Backdrop, ChatBackdrops, PanelItem, TodoList, Toolset } from '@shared/types'
import { panel } from './panel/store'
import { boardView } from './present/places'
import { backdrops } from './backdrops'
import { clearStats, summarize } from './turnstats'
import { worlds } from './worlds/store'
import { importMap } from './maps/importMap'
import { maps } from './maps/store'
import { mapListing, mapWithPlace } from './maps/usage'
import { rollDecision, rollFor } from './actions'
import { cleanAction } from '@shared/actions'
import { cleanDecision } from '@shared/decisions'
import { addCard, addSet, deckOf, setDeckOwner, swapCards, takeCard } from './cards/decks'
import { cleanDeckOwner, cleanSwap, hasSwap } from '@shared/cardDecks'
import { entryField, entryFields, resolveIncludes } from './library/includes'
import { mapReaders } from './maps/mapReaders'
import { visitorsOf, whoIsHere } from './worlds/presence'
import { journalAction, watchJourneys } from './worlds/journeys'
import { toolsets } from './toolsets/store'
import { skills } from './skills'
import { setBrowserOpener, setChatNudge, setViewNotifier } from './modules/sdk'
import { setBindingResolver } from './worlds/ops'
import type { ChatMessage, ModuleInfo } from '@shared/types'
import os from 'node:os'
import path from 'node:path'
import { board } from './board/store'
import { errorCode } from '@shared/errors'
import { carryDescribe, carryOpen, carryPeek, carrySave } from './carry'
import { portabilityDescribeKind, portabilityEstimate, portabilityExport, portabilityImport, portabilityPeek } from './portability'
import { agentFolders, liveFolder, removeFolderTree } from './agents/folders'
import { currentActor } from './timeline/actor'
import { compendium } from '../modules/dnd/compendium'
import { gameDefs } from '../modules/game/store'
import { awardCharacterXp, changeCreatureHealth, changeHealth as changeGameHealth, characterMisfits, giveItem, takeItem, joinCharacter, leaveCharacter, onEntityMoved, saveCharacter, tickCharacters, triggerStoryMoment, useAbility } from '../modules/game/characters'
import { saves } from './worlds/saves'
import './worlds/sheetTokens'
import { resolveTokens } from './worlds/tokenSources'
import { spawnCreature, updateCreature } from './worlds/creatures'
import { blueprintSources, searchBlueprints, spawnBlueprint } from './worlds/blueprints'
import { saveInPlay } from './worlds/playLayer'
import { adoptOldPlay, bring, createNewWorldSave, removeSave, removeWorldSaves, takeOut, travel } from './worlds/party'
import { decisions, storyActions } from '../modules/decisions/store'
import { factions } from './factions/store'
import { mapObjectsStore } from './mapObjects/store'
import { triggerActionsStore } from './triggerActions/store'
import { runEffects } from './effects/run'
import { lootTablesStore } from './lootTables/store'
import { widgetInfo } from './data/widgetSources'
import { resolveThings } from '../modules/core/things'
import './data/glances'
import './data/htmlWidget'
import './data/characterStatsWidget'
import './cards/drawerWidget'
import './present/widget'
import './library/partWidget'
import { ifMissing, noteFailure, report, reportError, setProblemSink } from './util/report'

let lastCpu: { idle: number; total: number } | null = null

function cpuPercent(): number | null {
  const now = os.cpus().reduce(
    (acc, c) => {
      const t = c.times
      acc.idle += t.idle
      acc.total += t.user + t.nice + t.sys + t.idle + t.irq
      return acc
    },
    { idle: 0, total: 0 }
  )
  const prev = lastCpu
  lastCpu = now
  if (!prev || now.total <= prev.total) return null
  return Math.round((1 - (now.idle - prev.idle) / (now.total - prev.total)) * 100)
}

const port = process.parentPort

function emit<K extends keyof Events>(event: K, payload: Events[K]): void {
  observeData(event, payload)
  port.postMessage({ event, payload })
}

setProblemSink((problem) => emit('engine.problem', problem))
process.on('unhandledRejection', (err) => reportError('error', 'engine', err))
process.on('uncaughtException', (err) => {
  reportError('error', 'engine', err, 'The engine hit an error it could not recover from and is restarting')
  setTimeout(() => process.exit(1), 100)
})

data.setEmitter(emit)
modules.on('changed', (list: ModuleInfo[]) => emit('tools.changed', list))
registerWorkoutExport()
registerEntryExports()
void modules.start()
setToolsFolderCheck((abs) => modules.isProtected(abs))

const models = new ModelRegistry()
const host = new ModelHost((entry) => {
  const info = models.list().find((m) => m.id === entry.id)?.info ?? null
  const mmproj = models.projectorPath(entry.id)
  return { mtpLayers: models.mtpLayers(entry.id), mmproj, architecture: info?.architecture ?? null, template: models.templateText(entry.id), traits: modelTraitSet(info, mmproj !== null), build: serverBuild() }
})
const afterModelChange = <T>(id: string, result: T): T => {
  emit('packs.changed', {})
  if (host.loadedId === id) host.checkRestart(models.getConfig(id))
  return result
}
reportChildren((pids) => emit('engine.children', { pids }))
const packs = new Packs({ shippedDir: () => path.join(appFolder(), 'packs'), ownDir: () => path.join(machineRoot(), 'packs'), models, build: serverBuild, devices: serverDevices })
models.setOverlay((id, own) => packs.overlay(id, own))
void packs.reload().catch((err: unknown) => noteFailure(err, 'packs', 'Could not load the optimization packs'))
installEvents.on('changed', (helper: string) => emit('install.changed', { helper }))
const packsChanged = (): void => {
  emit('packs.changed', {})
  const id = host.loadedId
  if (id) host.checkRestart(models.getConfig(id))
}
installEvents.onHelper(LLAMA_SERVER, packsChanged)
installEvents.on('progress', (progress) => emit('install.progress', progress))
onActivated(LLAMA_SERVER, async () => {
  await host.restartOnActive()
  await minds.embedder.restartOnActive()
})
void endLeftovers()
  .then((n) => n && report('warning', 'llama-server', `Ended ${n} llama-server${n > 1 ? 's' : ''} left running by an earlier run`))
  .catch((err: unknown) => noteFailure(err, 'llama-server', 'Could not end llama-servers left by an earlier run'))
const agents = new AgentRegistry()
agents.useFolders(agentFolders)
const agentFolder = (): string | null => {
  const id = currentActor().agentId
  return id ? liveFolder(agents.list().find((a) => a.id === id)?.folder) : null
}
data.pages.setDefaultParent(agentFolder)
data.assets.setDefaultParent(agentFolder)
const sessions = new SessionStore()
sessions.useIncognito((agentId) => agents.getOrDefault(agentId).incognito === true)
const requests = new UiRequests()
requests.on('changed', () => emit('ui.pending', requests.list()))
const permissions = new PermissionStore()
const checkpoints = new CheckpointStore((id) => sessions.files(id))
const runner = new ChatRunner(host, models, agents, sessions, requests, permissions, checkpoints, emit)
const modelRoutes = new ModelRoutes(host, models, { busy: () => runner.busy })
modelRoutes.on('ready', (info) => emit('engine.modelRoutes', info))
modelRoutes.start()
setGuideSource({
  guides: () => guideModules(),
  guide: (moduleId, agentId) => guideText(moduleId, agentId ? (agents.list().find((a) => a.id === agentId) ?? null) : null),
  agents: () => agents.list().map((a) => ({ id: a.id, name: a.name })),
  instructions: (agentId) => runner.agentInstructions(agentId)
})

setupCommands({ runner, sessions, agents })

setBindingResolver((agentId) => (agentId ? (agents.getOrDefault(agentId).world ?? null) : null))

models.on('changed', (list) => emit('models.changed', list))
downloads.on('changed', (list) => emit('downloads.changed', list))
host.on('state', (state) => emit('model.state', state))
agents.on('changed', (list) => emit('agents.changed', list))
setAgentAccess(agents)
sessions.on('changed', (list) => emit('sessions.changed', list))
sessions.on('todos', (sessionId: string, list: TodoList) => emit('todos.changed', { sessionId, list }))
backdrops.on('changed', (sessionId: string, state: ChatBackdrops) => emit('backdrop.changed', { sessionId, state }))
backdrops.on('app', (backdrop: Backdrop | null) => emit('backdrop.app', { backdrop }))
setViewNotifier((id) => emit('module.view', { id }))
setBrowserOpener((url) => emit('browser.open', { url }))
setChatNudge((sessionId, text) => {
  const attempt = (n: number) => {
    if (!sessions.list().some((s) => s.id === sessionId)) return
    if (runner.isRunning(sessionId) || runner.isCompacting(sessionId)) {
      if (n < 60) setTimeout(() => attempt(n + 1), 2000)
      return
    }
    runner.send(sessionId, text).catch((err: unknown) => (n < 60 ? setTimeout(() => attempt(n + 1), 2000) : noteFailure(err, 'chat', 'Could not nudge the chat')))
  }
  attempt(0)
})
data.pages.setSingles(() => modules.singlePages())
data.pages.setOnRemove((id, up) => data.assets.reparent(id, up))
workout.onChange(() => emit('workout.changed', {}))
board.onChange(() => emit('board.changed', {}))
compendium.on('changed', () => emit('dnd.changed', {}))
gameDefs.on('changed', () => emit('game.changed', {}))
saves.on('changed', (world: string) => emit('saves.changed', { world }))
decisions.on('changed', () => emit('decisions.changed', {}))
storyActions.on('changed', () => emit('storyActions.changed', {}))
factions.on('changed', () => emit('factions.changed', {}))
mapObjectsStore.on('changed', () => emit('mapObjects.changed', {}))
triggerActionsStore.on('changed', () => emit('triggerActions.changed', {}))
lootTablesStore.on('changed', () => emit('lootTables.changed', {}))
board.setNames((id) => agents.list().find((a) => a.id === id)?.name ?? 'an agent')
scripts.onChange(() => emit('python.changed', {}))
storyRuns.on('changed', () => emit('stories.changed', {}))
themes.on('changed', (list: Theme[]) => emit('themes.changed', list))
avatars.on('changed', (list: Avatar[]) => emit('avatars.changed', list))
themes.on('ambience', (sessionId: string, ambience: Ambience) => emit('ambience.changed', { sessionId, ambience }))
themes.on('cue', (cue: AmbienceCue) => emit('ambience.cue', cue))
data.setToolCheck((id) => modules.isOn(id))
toolsets.on('changed', (list: Toolset[]) => emit('toolsets.changed', { list }))
worlds.on('changed', (id: string) => emit('worlds.changed', { id }))
maps.on('changed', (id: string) => emit('maps.changed', { id }))
watchJourneys()
panel.on('changed', (sessionId: string, items: PanelItem[]) => emit('panel.changed', { sessionId, items }))
setSessionAccess(sessions, (id) => {
  runner.abort(id)
  runner.forget(id)
  sessions.delete(id)
})
linkedFolders.on('changed', (list) => emit('folders.changed', list))
reminders.on('changed', (list) => emit('reminders.changed', list))
reminders.on('fired', (payload) => {
  timeline.record({ kind: 'reminder', entry: payload.id, action: 'fired', by: null, chat: payload.sessionId })
  emit('reminder.fired', payload)
})
timeline.on('changed', () => emit('timeline.changed', null))
routines.on('changed', (list) => emit('routines.changed', list))
reminders.on('failed', ({ id, message }: { id: string; message: string }) => report('error', 'reminders', `Scheduled task ${id} could not run: ${message}`))
reminders.start({
  run: async (r) => {
    let sessionId = r.sessionId && sessions.list().some((s) => s.id === r.sessionId) ? r.sessionId : null
    if (!sessionId) sessionId = sessions.create(agents.getOrDefault(r.agentId).id).id
    await runner.send(sessionId, `[Scheduled task] ${r.text}`)
  }
})
routines.start({
  agentExists: (id) => agents.list().some((a) => a.id === id),
  createChat: (agentId) => sessions.create(agentId).id,
  chatExists: (id) => sessions.list().some((s) => s.id === id),
  setupChat: (id, title, mode) => void sessions.update(id, { title, ...(mode ? { permissionMode: mode } : {}) }),
  send: (sessionId, text) => runner.send(sessionId, text),
  finished: (sessionId) =>
    new Promise((resolve) => {
      const done = (id: string, message: ChatMessage) => {
        if (id !== sessionId) return
        runner.off('finished', done)
        resolve(message)
      }
      runner.on('finished', done)
    }),
  describe: (e) => describeEvent(e),
  resolveEntry: (kind, link) => resolveRoutineEntry(kind, link),
  writePage: (page, heading, text) => {
    const body = `\n## ${heading}\n${text}\n`
    const found = data.pages.find(page, (p) => !p.type)
    if (found) data.pages.write({ ref: found.id, body, mode: 'append' })
    else data.pages.create({ title: toId(page) || page, body, parent: null })
  },
  notify: (sessionId, title, message) => emit('ui.notify', { sessionId, title, message })
})
const chatSearch = new ChatSearch(sessions, () => agents.list())
minds.setup({ modelPath: (id) => (models.has(id) ? models.get(id).path : null) })
minds.useRelationships((id) => agents.find(id)?.relationships ?? [])
agents.on('relationships', (agent: AgentProfile) => {
  void minds.syncRelationships(agent.id, agent.relationships ?? []).catch((err: unknown) => noteFailure(err, 'memory', `Could not index ${agent.name}'s relationships`))
})
minds.on('changed', (agentId) => emit('mind.changed', { agentId }))
minds.on('indexing', (progress) => emit('mind.indexing', progress))
styles.on('changed', (list) => emit('styles.changed', list))
customCommands.on('changed', (list) => emit('commands.changed', list))
tagStore.on('changed', () => emit('tags.changed', {}))
setupReasoner({ host, models, agents, sessions })
setupProbe({ sessions, agents })
player.setSender((command) => emit('player.command', command))

type Handlers = {
  [K in EngineRequestName]: (
    params: EngineRequests[K]['params']
  ) => EngineRequests[K]['result'] | Promise<EngineRequests[K]['result']>
}

function warmIndexes(): void {
  try {
    data.pages.list()
    data.assets.list()
  } catch (err) {
    noteFailure(err, 'engine', 'Could not warm the indexes')
    return
  }
}

vaultEvents.on('unlocked', () => setTimeout(warmIndexes, 0))

const handlers: Handlers = {
  ping: () => ({ pid: process.pid, at: Date.now() }),
  crash: () => {
    setTimeout(() => process.exit(1), 150)
    return true
  },
  'models.list': () => models.list(),
  'models.scan': ({ folders }) => models.scan(folders),
  'models.add': ({ path }) => models.add(path),
  'models.remove': async ({ id }) => {
    if (host.loadedId === id) await host.unload()
    return models.remove(id)
  },
  'models.state': () => host.getState(),
  'models.remote.save': (input) => models.saveRemote(input),
  'models.remote.test': ({ id }) => apiTest(models.remoteTarget(id)),
  'models.remote.probe': (input) => apiProbe(models.previewRemoteTarget(input)),
  'models.remote.models': (input) => listRemoteModels(models.previewRemoteTarget({ ...input, model: '', contextSize: null })),
  'models.load': ({ id }) => {
    if (models.isRemote(id)) throw new Error('Remote models are not loaded here. Give an agent this model in Agents and it is used when that agent replies.')
    models.assertRunnable(id)
    models.touch(id)
    return host.load(models.get(id), models.getConfig(id))
  },
  'models.fillInfo': () => models.fillInfo(),
  'hub.search': ({ query }) => searchHub(query),
  'hub.files': ({ repo }) => hubFiles(repo),
  'hub.fileInfo': ({ repo, file }) => hubFileInfo(repo, file),
  'hub.repoFacts': ({ repo, updatedAt }) => hubRepoFacts(repo, updatedAt),
  'hub.token.has': () => serviceKeys.has(HUB_TOKEN),
  'hub.token.set': ({ token }) => (serviceKeys.set(HUB_TOKEN, token?.trim() || null), serviceKeys.has(HUB_TOKEN)),
  'downloads.list': () => downloads.list(),
  'downloads.start': (input) => downloads.start(input),
  'downloads.pause': ({ id }) => downloads.pause(id),
  'downloads.resume': ({ id }) => downloads.resume(id),
  'downloads.cancel': ({ id }) => downloads.cancel(id),
  'downloads.clear': () => downloads.clearFinished(),
  'models.unload': () => host.unload(),
  'models.favourite': ({ id, on }) => models.setFavourite(id, on),
  'models.kind': ({ id, kind }) => models.setKind(id, kind),
  'system.stats': async () => {
    const vram = await host.vram()
    return {
      cpu: cpuPercent(),
      ramUsed: os.totalmem() - os.freemem(),
      ramTotal: os.totalmem(),
      engineRss: process.memoryUsage().rss,
      vramUsed: vram?.used ?? null,
      vramTotal: vram?.total ?? null
    }
  },
  'models.params': () => PARAMS,
  'models.config.get': ({ id }) => models.ownConfig(id),
  'packs.list': async ({ id }) => {
    await packs.reload()
    return packs.listing(id)
  },
  'packs.set': ({ id, on }) => {
    packs.setOn(id, on)
    emit('packs.changed', {})
    return afterModelChange(id, packs.listing(id))
  },
  'packs.import': async ({ file }) => {
    const title = await packs.importPack(file)
    packsChanged()
    return { title }
  },
  'packs.remove': async ({ file }) => {
    await packs.removePack(file)
    packsChanged()
  },
  'models.config.set': ({ id, patch }) => afterModelChange(id, models.setConfig(id, patch)),
  'models.config.reset': ({ id }) => afterModelChange(id, models.resetConfig(id)),
  'models.projector.get': ({ id }) => ({ ...models.projectorFor(id), options: models.projectors().map(({ id: pid, name }) => ({ id: pid, name })) }),
  'models.projector.set': ({ id, projector }) => afterModelChange(id, { ...models.setProjector(id, projector), options: models.projectors().map(({ id: pid, name }) => ({ id: pid, name })) }),
  'models.template.get': ({ id }) => models.getTemplate(id),
  'models.template.set': ({ id, choice }) => {
    if (choice.type === 'jinja' && !choice.template.trim()) throw new Error('The Jinja template is empty. Paste a chat template, or set Chat template back to the one in the file.')
    return afterModelChange(id, models.setTemplate(id, choice))
  },
  'agents.list': () => agents.list(),
  'agents.get': ({ id }) => agents.get(id),
  'agents.save': (draft) => agents.save(draft),
  'agents.delete': ({ id, folder }) => {
    const gone = liveFolder(agents.get(id).folder)
    const removed = agents.delete(id)
    if (removed && gone && folder === 'delete') removeFolderTree(gone)
    return removed
  },
  'sessions.list': () => sessions.list(),
  'sessions.create': ({ agentId }) => sessions.create(agents.getOrDefault(agentId).id),
  'sessions.open': ({ id }) => ({
    meta: sessions.get(id),
    messages: runner.snapshot(id),
    running: runner.isRunning(id),
    usage: runner.usageFor(id),
    instructionsChanged: runner.instructionsChanged(id),
    summaries: runner.summaries(id),
    compacting: runner.isCompacting(id),
    todos: sessions.todos(id)
  }),
  'modules.pageView': ({ pageId, part }) => modules.pageView(pageId, part),
  'modules.pageAction': ({ pageId, name, payload }) => modules.pageAction(pageId, name, payload),
  'skills.list': () => skills.list(),
  'skills.read': ({ name }) => skills.read(name),
  'skills.write': ({ name, text }) => skills.write(name, text),
  'skills.delete': ({ name }) => skills.delete(name),
  'skills.template': () => skills.template(),
  'toolsets.list': () => toolsets.list(),
  'toolsets.save': (input) => toolsets.save(input),
  'toolsets.delete': ({ id }) => toolsets.delete(id),
  'worlds.list': () => worlds.list(),
  'worlds.create': ({ name, schema }) => worlds.create(name, schema ?? undefined),
  'worlds.rename': ({ id, name }) => worlds.rename(id, name),
  'worlds.setPlayer': ({ id, sheet }) => worlds.setPlayer(id, sheet),
  'worlds.setTags': ({ id, tags }) => worlds.setTags(id, tags),
  'actions.roll': ({ action, character, pick, world, deck }) => {
    const result = rollFor(cleanAction(action), character, pick ?? null)
    journalAction(world ?? null, result)
    if (deck && hasSwap(result.cards)) swapCards(deck, result.cards)
    return result
  },
  'decisions.roll': ({ decision }) => rollDecision(cleanDecision(decision)),
  'decks.find': ({ ref, make }) => deckOf(ref, make === true),
  'decks.take': ({ ref, card }) => ({ deck: takeCard(ref, card) }),
  'decks.add': ({ ref, card, by }) => ({ deck: addCard(ref, card, by) }),
  'decks.swap': ({ ref, swap }) => ({ deck: swapCards(ref, cleanSwap(swap)) }),
  'decks.addSet': ({ ref, set }) => ({ deck: addSet(ref, set) }),
  'decks.setOwner': ({ deck, owner }) => setDeckOwner(deck, owner ? cleanDeckOwner(owner) : null),
  'worlds.journey': ({ id, sheet }) => worlds.journeys(id)[sheet] ?? [],
  'worlds.addJourney': ({ id, sheet, kind, text }) => worlds.addJourney(id, sheet, kind, text),
  'places.visitors': ({ sheets }) => visitorsOf(sheets),
  'places.tokens': ({ world, tokens }) => resolveTokens(tokens, saveInPlay(world, false), world),
  'worlds.delete': ({ id }) => {
    removeWorldSaves(id)
    return worlds.delete(id)
  },
  'worlds.schema': ({ id }) => worlds.schema(id),
  'worlds.saveSchema': ({ id, schema }) => worlds.saveSchema(id, schema),
  'worlds.records': ({ id, type, layer }) => worlds.entities(id, type, true, layer ?? 'play'),
  'worlds.changes': ({ id, type, layer }) => worlds.changes(id, type, layer ?? 'play'),
  'maps.list': () => mapListing(),
  'maps.get': ({ id }) => maps.get(id),
  'maps.withPlace': ({ world, place }) => mapWithPlace(world, place),
  'places.here': ({ world }) => whoIsHere(world),
  'maps.create': ({ name }) => maps.create(name),
  'maps.save': ({ map }) => maps.save(map),
  'maps.import': ({ path: file, map }) => importMap(file, map),
  'worlds.maps': ({ id }) => worlds.mapUses(id),
  'worlds.useMap': ({ id, map }) => worlds.useMap(id, map),
  'worlds.dropMap': ({ id, map }) => worlds.dropMap(id, map),
  'worlds.saveMapUse': ({ id, use }) => worlds.saveMapUse(id, use),
  'maps.readers': () => mapReaders(),
  'worlds.put': ({ id, type, key, entity }) => (worlds.put(id, type, key, entity), true),
  'worlds.remove': ({ id, type, key }) => worlds.remove(id, type, key),
  'worlds.board': ({ id }) => worlds.board(id),
  'worlds.post': ({ id, author, to, message }) => worlds.post(id, author, to, message),
  'worlds.editPost': ({ id, index, message }) => worlds.editPost(id, index, message),
  'worlds.flags': ({ id }) => worlds.flags(id),
  'worlds.setFlag': ({ id, key, value }) => worlds.setFlag(id, key, value),
  'factions.list': () => factions.list(),
  'factions.get': ({ id }) => factions.get(id),
  'factions.save': ({ faction, previousId }) => factions.save(faction, previousId ?? null),
  'factions.delete': ({ id }) => { factions.remove(id); return true },
  'mapObjects.list': () => mapObjectsStore.list(),
  'mapObjects.get': ({ id }) => mapObjectsStore.get(id),
  'mapObjects.save': ({ object, previousId }) => mapObjectsStore.save(object, previousId ?? null),
  'mapObjects.delete': ({ id }) => { mapObjectsStore.remove(id); return true },
  'triggerActions.list': () => triggerActionsStore.list(),
  'triggerActions.get': ({ id }) => triggerActionsStore.get(id),
  'triggerActions.save': ({ action, previousId }) => triggerActionsStore.save(action, previousId ?? null),
  'triggerActions.delete': ({ id }) => { triggerActionsStore.remove(id); return true },
  'lootTables.list': () => lootTablesStore.list(),
  'lootTables.get': ({ id }) => lootTablesStore.find(id) ?? null,
  'lootTables.save': ({ table, previousId }) => lootTablesStore.save(table, previousId ?? null),
  'lootTables.delete': ({ id }) => { lootTablesStore.remove(id); return true },
  'lootTables.roll': ({ id }) => lootTablesStore.roll(id),
  'stats.clear': () => clearStats(),
  'server.status': async () => ({ build: serverBuild(), logLines: llamaLimits().logLines, chat: await host.chatServer(), memory: memoryServer(), vram: await host.vram() }),
  'server.build': () => serverBuild(),
  'install.state': ({ helper }) => installState(helper),
  'install.check': async ({ helper }) => {
    await refreshReleases(helper)
    return installState(helper)
  },
  'install.choices': ({ helper, tag }) => choiceViews(helper, tag),
  'install.start': async ({ helper, tag, build, root }) => {
    await install(helper, { tag, build, root })
    return installState(helper)
  },
  'install.cancel': ({ helper }) => cancelJob(helper),
  'install.activate': async ({ helper, version, restart }) => {
    await activate(helper, version, restart)
    return installState(helper)
  },
  'install.verify': async ({ helper, version }) => {
    await verifyVersion(helper, version)
    return installState(helper)
  },
  'install.remove': ({ helper, version }) => {
    removeVersion(helper, version)
    return installState(helper)
  },
  'install.addExisting': async ({ helper, folder }) => {
    await addExisting(helper, folder)
    return installState(helper)
  },
  'install.settings': ({ helper, values }) => {
    changeInstall(helper, (r) => {
      r.settings = values
    })
    installEvents.changed(helper)
    return installState(helper)
  },
  'install.space': ({ folder }) => ({ free: freeSpace(folder) }),
  'server.stop': () => host.unload(),
  'server.restart': async () => {
    const id = host.loadedId
    if (!id) return host.getState()
    await host.unload()
    return host.load(models.get(id), models.getConfig(id))
  },
  'stats.summary': () => {
    const id = host.loadedId
    let modelName: string | null = null
    let totalLayers: number | null = null
    if (id) {
      const m = models.list().find((x) => x.id === id)
      modelName = m?.name ?? null
      totalLayers = m?.info?.layers ?? null
    }
    return summarize({
      modelId: id,
      modelName,
      contextSize: id ? host.contextSize : null,
      gpuLayers: id ? host.gpuLayers : null,
      totalLayers
    })
  },
  'backdrop.get': ({ sessionId }) => backdrops.get(sessionId),
  'themes.list': () => themes.list(),
  'themes.save': (input) => themes.save(input),
  'themes.delete': ({ id }) => (themes.delete(id), true),
  'avatars.list': () => avatars.list(),
  'avatars.save': (input) => avatars.save(input),
  'avatars.delete': ({ id }) => (avatars.delete(id), true),
  'ambience.get': ({ sessionId }) => themes.ambience(sessionId),
  'ambience.set': ({ sessionId, ambience, minutes }) => themes.setAmbience(sessionId, ambience, minutes),
  'backdrop.set': ({ sessionId, scope, backdrop, minutes }) => backdrops.set(sessionId, scope, backdrop, minutes),
  'panel.list': ({ sessionId }) => panel.list(sessionId),
  'panel.showEntry': ({ sessionId, entry, part }) => panel.show(sessionId, 'data', modules.panelTab('data'), { view: partView(entry, part), key: entry }),
  'panel.showWidget': ({ sessionId, dashboardId, widgetId }) => {
    const d = data.dashboards.get(dashboardId)
    const w = d.widgets.find((x) => x.id === widgetId)
    if (!w) throw new Error(`Widget "${widgetId}" not found`)
    return panel.show(sessionId, 'dashboards', modules.panelTab('data'), { view: boardView(d, w), key: `widget:${w.id}` })
  },
  'panel.remove': ({ sessionId, id }) => panel.remove(sessionId, (i) => i.id === id),
  'panel.clear': ({ sessionId, tab }) => panel.remove(sessionId, (i) => i.tab === tab),
  'weblog.list': () => readLines<WebLogEntry>(WEB_LOG).reverse().slice(0, 1000),
  'reminders.list': () => reminders.list(),
  'reminders.cancel': ({ id }) => reminders.cancel(id),
  'reminders.enable': ({ id, on }) => reminders.setEnabled(id, on),
  'reminders.snooze': ({ id, minutes }) => reminders.snooze(id, minutes),
  'folders.list': () => linkedFolders.list(),
  'folders.save': (folder) => linkedFolders.save(folder),
  'folders.delete': ({ id }) => linkedFolders.delete(id),
  'search.chats': ({ query }) => chatSearch.chats(query),
  'search.memory': ({ query }) => chatSearch.memory(query),
  'todos.set': ({ sessionId, items }) => sessions.setTodos(sessionId, items, true),
  'sessions.compact': ({ id }) => runner.compact(id),
  'player.report': (state) => player.report(state),
  'user.get': () => identity.get(),
  'user.set': (input) => identity.set(input),
  'places.get': () => places.get(),
  'places.set': ({ key, value }) => places.set(key, value),
  'commands.list': ({ sessionId, agentId }) => commandsFor({ sessionId, agentId: sessionId ? sessions.get(sessionId).agentId : agentId }).map(commandInfo),
  'commands.run': ({ sessionId, agentId, line }) => runCommand(line, { sessionId, agentId: sessionId ? sessions.get(sessionId).agentId : agentId }),
  'tools.list': () => modules.list(),
  'tools.enable': ({ id }) => modules.enable(id),
  'tools.disable': ({ id }) => modules.disable(id),
  'tools.reload': ({ id }) => modules.reload(id),
  'tools.settings': ({ id, values }) => modules.setSettings(id, values),
  'tools.setPermission': ({ id, tool, permission }) => modules.setToolPermission(id, tool, permission),
  'tools.setModulePermission': ({ id, permission }) => modules.setModulePermission(id, permission),
  'tools.customize': ({ id, patch }) => modules.customize(id, patch),
  'tools.guide': ({ id }) => moduleGuidePreview(id),
  'tools.create': (input) => modules.create(input),
  'tools.importMcp': ({ json }) => modules.importMcp(json),
  'tools.installZip': ({ path: file, replace }) => modules.installZip(file, replace),
  'tools.action': ({ id, name }) => modules.runAction(id, name),
  'tools.prefs.get': () => modules.getPrefs(),
  'tools.prefs.set': (patch) => modules.setPrefs(patch),
  'contextPrefs.get': () => contextPrefs.get(),
  'contextPrefs.set': (patch) => contextPrefs.set(patch),
  'sessions.refreshInstructions': ({ id }) => runner.refreshInstructions(id),
  'sessions.context': ({ id }) => ({ usage: runner.usageFor(id), instructionsChanged: runner.instructionsChanged(id) }),
  'agents.contextUsage': ({ agentId }) => runner.draftUsage(agentId),
  'sessions.prompt': ({ id, agentId }) => runner.promptView(id, agentId),
  'agents.promptCost': ({ draft }) => runner.promptCost(draft),
  'sessions.send': ({ id, text, attachments, elements }) => runner.send(id, text, attachments ?? [], undefined, cleanElements(elements)),
  'sessions.abort': ({ id }) => runner.abort(id),
  'sessions.rename': ({ id, title }) => sessions.update(id, { title: title.trim() || 'Untitled' }),
  'sessions.delete': ({ id }) => {
    runner.abort(id)
    runner.forget(id)
    return sessions.delete(id)
  },
  'ui.respond': ({ id, value }) => requests.respond(id, value),
  'ui.pending': () => requests.list(),
  'sessions.setMode': ({ id, mode }) => sessions.update(id, { permissionMode: mode }),
  'sessions.setStyle': ({ id, style }) => sessions.update(id, { reasoningStyle: style }),
  'sessions.setThinking': ({ id, thinking }) => sessions.update(id, { thinking }),
  'sessions.setToolChoice': ({ id, toolChoice }) => sessions.update(id, { toolChoice }),
  'sessions.editResult': ({ id, messageId, partId, text }) => runner.editResult(id, messageId, partId, text),
  'sessions.editReply': ({ id, messageId, edits }) => runner.editReply(id, messageId, edits),
  'sessions.rewindPreview': ({ id, messageId }) => runner.rewindPreview(id, messageId),
  'sessions.rewind': ({ id, messageId }) => runner.rewind(id, messageId),
  'sessions.fork': ({ id, messageId }) => runner.fork(id, messageId),
  'permissions.get': () => permissions.get(),
  'permissions.set': (rules) => permissions.set(rules),
  'permissions.defaults': () => DEFAULT_RULES,
  'shell.info': () => detectShell(),
  'models.facts': () => host.facts(),
  'board.list': () => board.list(),
  'dnd.list': ({ kind }) => compendium.all(kind).map(({ text: _text, ...ref }) => ref),
  'dnd.get': ({ kind, id }) => {
    const entry = compendium.get(kind, id)
    return { entry, srd: compendium.isSrd(kind, id), own: compendium.own(kind).some((e) => e.id === id) }
  },
  'dnd.save': ({ kind, entry, previousId }) => compendium.save(kind, entry, previousId),
  'dnd.remove': ({ kind, id }) => compendium.remove(kind, id),
  'game.list': ({ type }) => gameDefs.list(type),
  'game.get': ({ type, id }) => gameDefs.get(type, id),
  'game.save': ({ type, def, previousId }) => gameDefs.save(type, def, previousId),
  'game.remove': ({ type, id }) => gameDefs.remove(type, id),
  'game.catalog': () => gameDefs.catalog(),
  'game.joinCharacter': ({ sheet, template }) => joinCharacter(sheet, template),
  'game.saveCharacter': ({ sheet, record }) => saveCharacter(sheet, record),
  'game.leaveCharacter': ({ sheet }) => leaveCharacter(sheet),
  'game.tickCharacters': ({ sheets, seconds }) => tickCharacters(sheets, seconds),
  'saves.list': ({ world }) => saves.worldSaves(world),
  'saves.all': () => saves.list(),
  'saves.get': ({ id }) => saves.get(id),
  'saves.current': ({ world }) => saves.current(world),
  'saves.create': ({ world, name, copy }) => (copy ? saves.create(world, name, true) : createNewWorldSave(world, name)),
  'saves.select': ({ world, id }) => saves.select(world, id),
  'saves.rename': ({ id, name }) => saves.rename(id, name),
  'saves.remove': ({ id }) => removeSave(id),
  'saves.bring': ({ id, sheet }) => bring(id, sheet),
  'saves.takeOut': ({ sheet }) => takeOut(sheet),
  'saves.adopt': ({ world }) => adoptOldPlay(world),
  'saves.travel': ({ sheet, id, map, place }) => travel(sheet, id, map, place),
  'saves.spawnCreature': ({ world, map, creature, faction, at }) => spawnCreature(world, map, creature, faction, at),
  'saves.updateCreature': ({ world, creature, faction }) => updateCreature(world, creature, faction),
  'saves.spawnBlueprint': ({ world, map, source, id, name, faction, at }) => spawnBlueprint(world, map, source, id, name, faction, at),
  'blueprints.sources': () => blueprintSources(),
  'blueprints.search': ({ source, query, limit }) => searchBlueprints(source, query, limit),
  'game.misfits': ({ sheet }) => characterMisfits(sheet),
  'game.giveItem': ({ sheet, item, count, gold }) => giveItem(sheet, item, count, gold),
  'game.takeItem': ({ sheet, item, count }) => takeItem(sheet, item, count),
  'game.changeHealth': ({ sheet, delta }) => changeGameHealth(sheet, delta),
  'game.changeCreatureHealth': ({ world, uid, delta }) => changeCreatureHealth(world, uid, delta),
  'effects.run': (req) => runEffects(req),
  'game.useAbility': ({ sheet, ability, target, at, distance }) => useAbility(sheet, ability, target, at, distance),
  'game.awardXp': ({ sheet, amount, classId, reason }) => awardCharacterXp(sheet, { amount, classId, reason }),
  'game.onMove': (req) => onEntityMoved(req),
  'game.storyTrigger': ({ sheet, tag, summary, detail, flags }) => triggerStoryMoment(sheet, { tag, summary, detail, flags }),
  'saves.markUsed': ({ id, trigger, flag }) => saves.markUsed(id, trigger, flag),
  'saves.setFlag': ({ id, flag }) => saves.setFlag(id, flag),
  'saves.writeClock': ({ id, clockId, clock }) => saves.writeClock(id, clockId, clock),
  'decisions.get': ({ id }) => decisions.get(id),
  'decisions.save': ({ decision, previousId }) => decisions.save(decision, previousId),
  'storyActions.get': ({ id }) => storyActions.get(id),
  'storyActions.list': () => storyActions.list(),
  'decisions.list': () => decisions.list(),
  'storyActions.save': ({ action, previousId }) => storyActions.save(action, previousId),
  'dnd.import': ({ kind, json, apply }) => {
    let raw: unknown
    try {
      raw = JSON.parse(json)
    } catch {
      throw new Error('That is not valid JSON.')
    }
    return compendium.import(kind, raw, apply)
  },
  'board.add': ({ text }) => board.add(null, text),
  'board.update': ({ id, text }) => board.update(id, text),
  'board.remove': ({ id }) => (board.remove(id), true),
  'workout.overview': () => workout.overview(),
  'workout.history': () => workout.history(),
  'workout.log': ({ workout: w, date, sets }) => workout.record(w, date, sets),
  'workout.deleteSession': ({ date, workout: w }) => (workout.deleteSession(w, date), true),
  'export.describe': ({ source, args, options }) => describeExport(source, args, options),
  'export.build': (choice) => buildExport(choice),
  'workout.setLog': ({ date, exercise, workout: w, values }) => (workout.setLog(date, exercise, w, values), true),
  'workout.deleteDay': ({ date }) => (workout.deleteDay(date), true),
  'workout.patchExercise': ({ id, unit, muscles }) => (workout.patchExercise(id, { unit, muscles }), true),
  'workout.logExercise': ({ date, exercise, workout: w, values }) => workout.logExercise(date, exercise, values, w),
  'workout.save': ({ type, id, title, data: value }) => workout.save(type, { id, title, data: value }),
  'workout.saveWorkouts': ({ json }) => workout.saveWorkouts(json),
  'workout.workoutsFormat': () => WORKOUTS_FORMAT,
  'workout.saveExercises': ({ json }) => workout.saveExercises(json),
  'workout.exercisesFormat': () => EXERCISES_FORMAT,
  'python.scripts': () => scripts.list(),
  'stories.list': () => storyRuns.summaries(),
  'stories.act': ({ id, action, note }) => storyRuns.act(id, action, note),
  'stories.delete': ({ id }) => (storyRuns.delete(id), true),
  'python.save': ({ id, name, code, description }) => scripts.save({ id, name, code, description }),
  'python.delete': ({ id }) => (scripts.delete(id), true),
  'python.run': async ({ id }) => (await scripts.run(id)).script,
  'library.find': ({ query, kind }) => libraryFind(query, kind, 2000, USER),
  'library.reindex': () => {
    clearIndexes()
    warmIndexes()
    return true
  },
  'library.overview': ({ query, perKind, kind, kinds, skip }) => libraryOverview(query, perKind, USER, kinds ?? (kind ? [kind] : null), skip ?? []),
  'timeline.recent': ({ limit }) => timelineRows(Math.min(50, Math.max(1, limit)), USER),
  'routines.list': () => routines.list(),
  'routines.save': (draft) => routines.save(draft),
  'routines.enable': ({ id, on }) => routines.setEnabled(id, on),
  'routines.run': ({ id }) => (routines.runNow(id), true),
  'library.kinds': () => allKinds(),
  'library.kindInfo': () => kindInfo(),
  'library.guides': () => specialPages(USER),
  'library.clearKind': ({ kind }) => clearKind(kind),
  'library.rename': ({ entry, name }) => renameEntry(entry, name),
  'library.rollText': ({ text }) => rollText(text),
  'slideshows.save': ({ id, title, data: value }) => (id ? saveSlideshow(id, value) : createSlideshow(title, value)),
  'carry.save': (input) => carrySave(input),
  'carry.describe': ({ entry }) => carryDescribe(entry),
  'carry.peek': ({ sources }) => carryPeek(sources),
  'carry.open': ({ source, mode }) => carryOpen(source, mode),
  'portability.describeKind': ({ kind }) => portabilityDescribeKind(kind),
  'portability.estimate': (input) => portabilityEstimate(input),
  'portability.export': (input) => portabilityExport(input),
  'portability.peek': (input) => portabilityPeek(input),
  'portability.import': (input) => portabilityImport(input),
  'sheets.list': () => sheetIds().map((s) => getSheet(s.id)),
  'sheets.get': ({ id }) => getSheet(id),
  'repos.list': () => allRepos(),
  'repos.get': ({ id }) => getRepo(id),
  'repos.save': (input) => saveRepo(input),
  'sheets.save': (input) => saveSheet(input),
  'sheets.setFaction': ({ id, faction }) => setSheetFaction(id, faction),
  'library.remove': ({ entry }) => (removeEntry(entry), true),
  'tags.set': ({ entry, tags }) => {
    const { kind, id } = resolveEntry(entry, null, USER)
    return tagStore.set(kind.kind, id, tags)
  },
  'tags.of': ({ entry }) => {
    const { kind, id } = resolveEntry(entry, null, USER)
    return tagStore.of(kind.kind, id)
  },
  'tags.list': ({ kind }) => tagStore.counts(kind ?? undefined),
  'tags.map': () => tagStore.map(),
  'library.resolve': ({ entry }) => {
    const { kind, id } = resolveEntry(entry, null, USER)
    return { kind: kind.kind, id }
  },
  'library.exportFolder': (input) => exportToFolder(input),
  'library.preview': ({ entry }) => previewEntry(entry, USER),
  'library.drawable': () => drawableEntries(USER),
  'library.draw': ({ entry, count }) => drawEntry(entry, Math.max(1, Math.round(count)), USER),
  'library.read': ({ entry }) => {
    const { kind, id } = resolveEntry(entry, null, USER)
    return resolveIncludes(kind.full(id, {}, USER))
  },
  'library.fields': ({ entry }) => entryFields(entry),
  'library.inside': ({ entry }) => entryInside(entry),
  'library.field': ({ entry, field }) => entryField(entry, field),
  'data.pages.list': () => data.pages.list(),
  'data.pages.get': ({ id }) => data.pages.get(id),
  'data.pages.find': ({ id }) => ifMissing(() => data.pages.get(id), null),
  'data.pages.create': ({ title, body, fields, type, parent }) => data.pages.create({ title, body, fields, type, parent: parent ?? null }),
  'data.pages.write': ({ id, title, body }) => data.pages.write({ ref: id, title, body }),
  'data.pages.append': ({ ref, text }) => data.pages.write({ ref, title: ref, body: text, mode: 'append' }),
  'data.pages.view': ({ id, view }) => data.pages.setView(id, view),
  'data.pages.image': ({ id, image }) => data.pages.setImage(id, image),
  'data.pages.voice': ({ id, voice }) => data.pages.setVoice(id, voice),
  'tts.piperVoices': ({ folder }) => piperVoices(folder),
  'tts.piper': ({ exe, folder, voice, text, rate }) => piperSpeak(exe, folder, voice, text, rate),
  'data.pages.fields': ({ id, changes }) => data.pages.editFields(id, changes),
  'data.pages.delete': ({ id }) => data.pages.delete(id),
  'data.pages.move': ({ id, parent }) => data.pages.move(id, parent),
  'data.pages.search': ({ query }) => data.pages.search(query),
  'data.pages.backlinks': ({ id }) => data.pages.backlinks(id),
  'data.records.add': ({ pageId, values, at }) => data.pages.addRecords(pageId, [values], {}, at)[0],
  'data.records.update': ({ pageId, recordId, values }) => data.pages.updateRecords(pageId, [{ id: recordId, values }])[0],
  'data.records.move': ({ pageId, recordId, to }) => (data.pages.moveRecord(pageId, recordId, to), true),
  'data.records.delete': ({ pageId, recordIds }) => data.pages.deleteRecords(pageId, recordIds),
  'data.assets.list': () => data.assets.list(),
  'data.assets.get': ({ id }) => data.assets.get(id),
  'data.assets.find': ({ id }) => (data.assets.exists(id) ? data.assets.get(id) : null),
  'data.assets.import': ({ paths: files, parent }) => {
    const folder = data.pages.folderOf(parent ?? null)
    return files.map((f) => {
      const added = data.assets.register(f, { tool: null, sessionId: null, original: f })
      return folder ? data.assets.move(added.id, folder) : added
    })
  },
  'data.import': ({ paths: files, parent }) => importToLibrary(files, parent),
  'data.pages.makeFolders': ({ path: folder }) => data.pages.makeFolders(folder),
  'data.assets.delete': ({ id }) => data.assets.delete(id),
  'data.assets.move': ({ id, parent }) => data.assets.move(id, data.pages.folderOf(parent)),
  'data.assets.path': ({ id }) => data.assets.filePath(data.assets.get(id)),
  'dashboards.list': () => data.dashboards.list(),
  'dashboards.home': () => data.dashboards.home(),
  'dashboards.create': ({ name, icon, onToolbar }) => data.dashboards.create({ name, icon, onToolbar }),
  'dashboards.update': ({ id, ...patch }) => data.dashboards.update(id, patch),
  'dashboards.delete': ({ id }) => data.dashboards.delete(id),
  'dashboards.reorder': ({ ids }) => data.dashboards.reorder(ids),
  'widgets.add': ({ dashboardId, title, source, view, options }) => data.dashboards.addWidget(dashboardId, { title, source, view, options }).dashboard,
  'widgets.create': ({ dashboardId, kind }) => data.dashboards.createWidget(dashboardId, kind),
  'widgets.info': () => widgetInfo(),
  'widgets.update': ({ dashboardId, widgetId, ...patch }) => data.dashboards.updateWidget(dashboardId, widgetId, patch).dashboard,
  'widgets.remove': ({ dashboardId, widgetId }) => data.dashboards.removeWidget(dashboardId, widgetId),
  'widgets.place': ({ dashboardId, things, at }) => data.placeSources(dashboardId, resolveThings(things, true, USER).sources, at),
  'data.assets.importBytes': ({ name, base64 }) => data.assets.registerBytes(path.basename(name).replace(/[^\w.\- ]/g, '_') || 'pasted.png', Buffer.from(base64, 'base64'), { tool: null, sessionId: null, original: null }),
  'data.assets.setNetwork': ({ id, on }) => data.assets.setNetwork(id, on),
  'data.assets.describe': ({ id, description, areas }) => data.assets.describe(id, description, areas),
  'widgets.layout': ({ dashboardId, layouts }) => data.dashboards.setLayouts(dashboardId, layouts),
  'vault.status': () => vaultStatus(),
  'vault.setKey': ({ key }) => {
    if (!key) runner.lock()
    setPrivateKey(key ? Buffer.from(key, 'base64') : null)
    sessions.reload()
    if (key) requests.resolveKind('unlock', true)
    const status = vaultStatus()
    emit('vault.changed', status)
    return status
  },
  'vault.migrate': () => migrate(),
  'data.check': () => checkFiles(),
  'mind.overview': ({ agentId }) => minds.overview(agentId),
  'mind.memories': ({ agentId }) => minds.memories(agentId),
  'mind.remember': ({ agentId, id, text, pinned }) => minds.remember(agentId, { id, text, pinned, by: 'user', sessionId: null }),
  'mind.forget': ({ agentId, id }) => (minds.forget(agentId, id, null), true),
  'mind.thoughts': ({ agentId, month }) => minds.thoughts(agentId, month),
  'mind.forgetThought': ({ agentId, id }) => minds.forgetThought(agentId, id),
  'mind.forgetJournal': ({ agentId, id }) => minds.forgetJournal(agentId, id),
  'mind.journal': ({ agentId, month }) => minds.journal(agentId, month),
  'mind.search': ({ agentId, query, limit }) => minds.search(agentId, query, limit ?? 20),
  'mind.prefs.get': () => ({ ...minds.getPrefs(), loaded: minds.embedder.loaded, error: minds.embedder.error }),
  'mind.prefs.set': (patch) => {
    minds.setPrefs(patch)
    return { ...minds.getPrefs(), loaded: minds.embedder.loaded, error: minds.embedder.error }
  },
  'styles.list': () => styles.list(),
  'commands.custom.list': () => customCommands.list(),
  'commands.custom.save': (input) => customCommands.save(input),
  'commands.custom.delete': ({ id }) => customCommands.delete(id),
  'styles.save': (input) => styles.save(input),
  'styles.delete': ({ id }) => styles.delete(id),
  'dev.simulateTools': ({ sessionId, prompt, calls }) => {
    if (process.env.SEVEN_DEV_TOOLS !== '1') throw new Error('dev.simulateTools is only available with SEVEN_DEV_TOOLS=1')
    return runner.simulate(sessionId, prompt, calls)
  }
}

port.on('message', async ({ data }) => {
  const { id, name, params } = data as EngineWireRequest
  const handler = handlers[name] as ((p: unknown) => unknown) | undefined
  if (!handler) {
    port.postMessage({ id, ok: false, error: `Unknown request: ${name}` })
    return
  }
  try {
    await modules.ready()
    const result = await handler(params)
    port.postMessage({ id, ok: true, result })
  } catch (err) {
    port.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err), code: errorCode(err) ?? undefined })
  }
})

const shutdown = async (): Promise<void> => {
  runner.closeActive()
  try {
    timeline.flush()
  } catch (err) {
    reportError('warning', 'timeline', err, 'Could not save the timeline on exit')
  }
  await modules.dispose().catch((err: unknown) => noteFailure(err, 'engine', 'Could not shut the modules down'))
  await modelRoutes.close().catch((err: unknown) => noteFailure(err, 'engine', 'Could not close the model routes'))
  await host.dispose().catch((err: unknown) => noteFailure(err, 'engine', 'Could not stop the model server'))
  await minds.embedder.unload().catch((err: unknown) => noteFailure(err, 'engine', 'Could not stop the embedding server'))
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown())
