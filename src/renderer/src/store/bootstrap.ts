import { runPlayerCommand } from './player'
import { engine, main, on } from '../lib/ipc'
import { errorText } from '../lib/format'
import { useApp } from './app'
import { useModels } from './models'
import { useAgents } from './agents'
import { useSessions } from './sessions'
import { toast } from './toasts'
import { useData } from './data'
import { useThemes } from './themes'
import { useDashboards } from './dashboards'
import { useTools } from './tools'
import { useReactions } from './reactions'
import { usePanel } from './panel'
import { useDrafts } from './drafts'
import { usePhases } from './phases'
import { useBackdrops } from './backdrops'
import { useToolsets } from './toolsets'
import { presentData, useStage } from '../registries/presentations'
import '../components/present/story'
import '../components/present/scene'
import '../components/data/kindUis'
import '../components/dnd/compendiumUis'
import '../components/game/gameUis'
import '../components/maps/sheetTokens'
import '../components/data/PartView'
import '../registries/sources'
import '../components/present/template'
import '../components/present/Suggestions'
import '../components/present/TimerCard'
import '../components/present/Aside'
import '../components/play/ActionPresentation'
import '../components/present/Handout'
import '../components/mind/ThoughtDraft'
import '../components/present/PresentWidget'
import '../components/dashboards/HtmlWidget'
import '../components/dashboards/Glances'
import { useWidgetInfo } from './widgetInfo'
import { clearPersonal, isLockedError, useVault } from './vault'
import { useStyleList } from './styles'
import { focusedConversation, openChat, openConversations, recheckOpen } from '../lib/conversation'
import { useWindows } from './windows'
import { usePlaces } from './places'
import { useDownloads } from './downloads'
import { failed } from '../lib/notify'

export type WindowMode = 'app' | 'overlay'

let mode: WindowMode = 'app'

async function loadEngineState(retried = false): Promise<void> {
  try {
    const results = await Promise.allSettled([useTools.getState().refresh(), useModels.getState().refresh(), useAgents.getState().refresh(), useSessions.getState().refresh(openConversations().flatMap((c) => (c.sessionId ? [c.sessionId] : []))), useData.getState().refresh(), useDashboards.getState().refresh(), useWidgetInfo.getState().refresh(), useThemes.getState().refresh(), useStyleList.getState().refresh(), usePlaces.getState().refresh(), useDownloads.getState().refresh()])
    const lockedFail = results.some((r) => r.status === 'rejected' && isLockedError(r.reason))
    if (lockedFail && !retried && useVault.getState().status.unlocked) {
      useVault.setState({ status: await main('vault.status') })
      return loadEngineState(true)
    }
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected' && !isLockedError(r.reason))
    if (failed) throw failed.reason
    const home = focusedConversation()
    const first = useSessions.getState().list[0]
    if (mode === 'overlay' && home && !home.sessionId && first) home.go(first.id)
    else recheckOpen()
  } catch (err) {
    if (!isLockedError(err)) toast.error('Could not reach the engine', errorText(err))
  }
}

let started = false

export async function bootstrap(windowMode: WindowMode = 'app'): Promise<void> {
  if (started) return
  started = true
  mode = windowMode
  useWindows.getState().setHome(mode === 'overlay' ? 'overlay' : 'chat')

  if (mode === 'app') {
    on('app.focusSession', ({ sessionId }) => openChat(sessionId))
  }

  on('engine.status', (status) => {
    const previous = useApp.getState().engine
    useApp.setState({ engine: status })
    if (status.state === 'ready' && previous.state !== 'ready') void loadEngineState()
    if (status.state === 'crashed') toast.error('Engine stopped unexpectedly', 'Restarting it now.')
  })
  on('settings.changed', (settings) => useApp.setState({ settings }))
  on('vault.changed', (status) => {
    const previous = useVault.getState().status
    useVault.setState({ status, ...(status.unlocked ? { asking: false } : {}) })
    if (previous.unlocked && !status.unlocked) clearPersonal()
    if (status.unlocked !== previous.unlocked || status.configured !== previous.configured) void loadEngineState().then(recheckOpen)
  })
  on('model.state', (host) => {
    const previous = useModels.getState().host.status
    useModels.setState({ host })
    if (host.status !== previous && (host.status === 'ready' || host.status === 'unloaded')) recheckOpen()
  })
  on('models.changed', (list) => useModels.setState({ list }))
  on('downloads.changed', (list) => useDownloads.getState().setList(list))
  on('styles.changed', (list) => useStyleList.setState({ list }))
  on('agents.changed', (list) => {
    useAgents.setState({ list })
    recheckOpen()
  })
  on('context.usage', ({ sessionId, usage }) => useSessions.getState().onUsage(sessionId, usage))
  on('tools.changed', (list) => {
    useTools.getState().setList(list)
    recheckOpen()
  })
  on('player.command', runPlayerCommand)
  on('mind.changed', () => recheckOpen())
  on('context.compacting', ({ sessionId, active }) => useSessions.getState().onCompacting(sessionId, active))
  on('context.compacted', ({ sessionId, trimmed, summarised }) => {
    const sessions = useSessions.getState()
    if (openConversations().some((c) => c.sessionId === sessionId)) void sessions.load(sessionId).catch(() => undefined)
    if (summarised > 0) toast.info('Chat summarised', `The oldest ${summarised} turn${summarised > 1 ? 's were' : ' was'} replaced by a summary for the model. The chat itself is unchanged.`)
    else if (trimmed > 0 && mode === 'app') toast.info('Old tool output trimmed', `${trimmed} old tool result${trimmed > 1 ? 's were' : ' was'} removed from the model's context to save space.`)
  })
  on('sessions.changed', (list) => useSessions.getState().setList(list))
  on('session.rewritten', ({ sessionId }) => {
    if (openConversations().some((c) => c.sessionId === sessionId)) void useSessions.getState().load(sessionId).catch(failed('Could not reload the chat'))
  })
  on('turn.start', ({ sessionId, userMessage, assistantMessage }) =>
    useSessions.getState().onTurnStart(sessionId, userMessage, assistantMessage)
  )
  on('text.delta', ({ sessionId, messageId, text }) => useSessions.getState().onDelta(sessionId, messageId, 'text', text))
  on('thought.delta', ({ sessionId, messageId, text }) =>
    useSessions.getState().onDelta(sessionId, messageId, 'thought', text)
  )
  on('turn.finish', ({ sessionId, message }) => {
    useDrafts.getState().clear(message.id)
    usePhases.getState().clear(message.id)
    useSessions.getState().onTurnFinish(sessionId, message)
    if (message.status === 'error') useReactions.getState().onFailed(sessionId)
    void useSessions.getState().checkContext(sessionId)
  })
  on('message.part', ({ sessionId, messageId, part }) => {
    useDrafts.getState().clear(messageId, part.name)
    useSessions.getState().onPart(sessionId, messageId, part)
    const data = part.status === 'done' && part.view?.kind === 'present' ? presentData(part.view.data) : null
    if (data?.where === 'stage' && focusedConversation()?.sessionId === sessionId) useStage.getState().play(data)
  })
  on('toolsets.changed', ({ list }) => useToolsets.getState().set(list))
  void useToolsets.getState().load().catch(() => undefined)
  on('backdrop.changed', ({ sessionId, state }) => useBackdrops.getState().set(sessionId, state))
  on('backdrop.app', ({ backdrop }) => void useApp.getState().updateSettings({ backdrop }).catch(() => undefined))
  on('turn.phase', ({ messageId, phase }) => usePhases.getState().set(messageId, phase))
  on('tool.draft', ({ messageId, callIndex, name, chunk, done }) => useDrafts.getState().chunk(messageId, callIndex, name, chunk, done))
  on('folders.changed', () => recheckOpen())
  on('panel.changed', ({ sessionId, items }) => usePanel.getState().set(sessionId, items))
  on('todos.changed', ({ sessionId, list }) => useSessions.setState((s) => ({ todos: { ...s.todos, [sessionId]: list } })))
  on('agent.reaction', (r) => useReactions.getState().onReaction(r))
  on('ui.notify', ({ title, message }) => toast.info(title, message))
  on('tool.output', ({ partId, chunk }) => useSessions.getState().onOutput(partId, chunk))
  on('page.changed', ({ id, meta }) => useData.getState().onPage(id, meta))
  on('asset.changed', ({ id, meta }) => useData.getState().onAsset(id, meta))
  on('dashboard.changed', ({ id, dashboard }) => useDashboards.getState().onChanged(id, dashboard))
  on('themes.changed', (list) => useThemes.setState({ list }))
  on('ambience.changed', ({ sessionId, ambience }) => useThemes.getState().setAmbience(sessionId, ambience))
  on('engine.error', ({ message }) => toast.error('Engine error', message))

  const [settings, info, status, vault] = await Promise.all([main('settings.get'), main('app.info'), main('engine.status'), main('vault.status')])
  useVault.setState({ status: vault })
  useApp.setState({ settings, info, engine: status, ...(mode === 'app' ? { view: settings.lastView } : {}) })
  if (mode === 'app' && info.vaultMissing) toast.error('Vault folder not found', `${info.vaultMissing} isn't there, so Seven opened the default vault. Connect it and switch to it in Settings, Vault.`)
  if (status.state === 'ready') {
    await engine('ping').catch(() => undefined)
    await loadEngineState()
  }
}
