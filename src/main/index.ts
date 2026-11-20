import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { EngineSupervisor } from './engine-supervisor'
import { broadcast, createAppWindow } from './app-window'
import { Vault } from './vault'
import { createNotifier } from './notifications'
import { createTray, type SevenTray } from './tray'
import { registerIpc } from './ipc'
import { Gateway } from './network/gateway'
import { Bridge } from './network/bridge'
import { setupBrowser } from './browser'
import { settings } from './settings'
import { Channel, type EngineRequestName, type EventMessage } from '@shared/protocol'
import { protocol } from 'electron'
import { assetScheme, handleAssets } from './assets'
import { resetWindow } from './windowState'
import { handleWidgets, widgetScheme } from './widgets'
import { noteMainFailure, problems } from './problems'
import { vaultsReadError } from './paths'
import { errorReport, type Problem, type ProblemReport } from '@shared/problems'

const engine = new EngineSupervisor(() => settings.get().problems.stderrLines)
engine.on('problem', (report: ProblemReport) => problems.add(report))
if (settings.loadError) noteMainFailure(settings.loadError, 'settings', 'Could not read settings.json, so Seven started with default settings', 'error')
if (vaultsReadError) noteMainFailure(vaultsReadError, 'vault', 'Could not read the list of vaults, so Seven opened the default vault', 'error')
process.on('uncaughtException', (err) => problems.add({ severity: 'error', area: 'main', ...errorReport(err) }))
process.on('unhandledRejection', (err) => problems.add({ severity: 'error', area: 'main', ...errorReport(err) }))

let appWindow: BrowserWindow | null = null
let tray: SevenTray | null = null
let quitting = false

function ensureAppWindow(show: boolean): BrowserWindow {
  if (appWindow && !appWindow.isDestroyed()) return appWindow
  const win = createAppWindow({ show, onEvent: broadcast })
  win.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    win.hide()
  })
  win.on('closed', () => {
    if (appWindow === win) appWindow = null
  })
  appWindow = win
  return win
}

function showApp(sessionId: string | null): void {
  const win = ensureAppWindow(true)
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  if (sessionId) {
    const send = () => win.webContents.send(Channel.event, { event: 'app.focusSession', payload: { sessionId } })
    if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send)
    else send()
  }
}

let vault: Vault | null = null
let gateway: Gateway | null = null
let bridge: Bridge | null = null

function quit(): void {
  quitting = true
  app.quit()
}

function applyLoginItem(enabled: boolean): void {
  if (!app.isPackaged || process.platform !== 'win32') return
  app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] })
}

protocol.registerSchemesAsPrivileged([assetScheme(), widgetScheme()])

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showApp(null))

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.seven.app')
    handleAssets()
    handleWidgets()

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    vault = new Vault(engine, broadcast)
    const network = new Gateway(() => engine.modelRoutes())
    gateway = network
    const ipc = registerIpc({ engine, vault, gateway: network, problems, showApp, quit })
    const link = new Bridge(() => network.settings(), network.devices, network.uploads, (name, params) => engine.request(name as EngineRequestName, params as never), ipc, () => void network.refresh())
    network.attachBridge({ connected: () => link.connectedDevices(), disconnect: (deviceId) => link.disconnectDevice(deviceId) })
    bridge = link
    network.on('server', (server) => link.attach(server))
    const share = (message: EventMessage) => {
      broadcast(message)
      link.feed(message)
    }
    network.on('changed', (status) => share({ event: 'network.changed', payload: status }))
    engine.on('event', share)
    problems.on('changed', (list: Problem[]) => share({ event: 'problems.changed', payload: list }))
    problems.on('added', (problem: Problem, shown: boolean) => share({ event: 'problem.new', payload: { problem, shown } }))
    setupBrowser(engine)
    engine.on('event', createNotifier(showApp))

    let previous = settings.get()
    settings.on('changed', (value) => {
      broadcast({ event: 'settings.changed', payload: value })
      if (value.startWithWindows !== previous.startWithWindows) applyLoginItem(value.startWithWindows)
      if (value.problems.keep !== previous.problems.keep) problems.trim()
      previous = value
    })

    engine.start()
    network.start()

    const startHidden = process.argv.includes('--hidden')
    ensureAppWindow(!startHidden)

    const current = settings.get()
    applyLoginItem(current.startWithWindows)

    tray = createTray({
      showApp: () => showApp(null),
      resetWindow: () => resetWindow(ensureAppWindow(true)),
      quit
    })

    app.on('activate', () => showApp(null))
  })

  app.on('before-quit', () => {
    quitting = true
    vault?.wipeCopies()
    engine.stop()
    bridge?.detach()
    void gateway?.close()
    tray?.tray.destroy()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
