import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { EngineSupervisor } from './engine-supervisor'
import { broadcast, createAppWindow } from './app-window'
import { Vault } from './vault'
import { createNotifier } from './notifications'
import { OverlayController } from './overlay'
import { Hotkey } from './hotkey'
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

const engine = new EngineSupervisor()
const overlay = new OverlayController(broadcast)
const hotkey = new Hotkey(() => {
  if (!settings.get().overlayEnabled) settings.set({ overlayEnabled: true })
  overlay.toggle()
})

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
    const ipc = registerIpc({ engine, overlay, hotkey, vault, gateway: network, showApp, quit })
    const link = new Bridge(() => network.settings(), network.devices, network.uploads, (name, params) => engine.request(name as EngineRequestName, params as never), ipc, () => void network.refresh())
    network.attachBridge({ connected: () => link.connectedDevices(), disconnect: (deviceId) => link.disconnectDevice(deviceId) })
    bridge = link
    network.on('server', (server) => link.attach(server))
    network.on('changed', (status) => {
      const message: EventMessage = { event: 'network.changed', payload: status }
      broadcast(message)
      link.feed(message)
    })
    engine.on('event', (message: EventMessage) => {
      broadcast(message)
      link.feed(message)
    })
    setupBrowser(engine)
    engine.on('event', createNotifier(showApp))

    let previous = settings.get()
    settings.on('changed', (value) => {
      broadcast({ event: 'settings.changed', payload: value })
      if (value.overlayEnabled !== previous.overlayEnabled) {
        overlay.setEnabled(value.overlayEnabled)
        tray?.refresh()
      }
      if (value.startWithWindows !== previous.startWithWindows) applyLoginItem(value.startWithWindows)
      previous = value
    })

    engine.start()
    network.start()

    const startHidden = process.argv.includes('--hidden')
    ensureAppWindow(!startHidden)

    const current = settings.get()
    if (current.overlayEnabled) overlay.show()
    const hotkeyError = hotkey.apply(current.hotkey)
    if (hotkeyError) console.warn(`[Seven] Hotkey not registered: ${hotkeyError}`)
    applyLoginItem(current.startWithWindows)

    tray = createTray({
      showApp: () => showApp(null),
      resetWindow: () => resetWindow(ensureAppWindow(true)),
      toggleOverlay: () => settings.set({ overlayEnabled: !settings.get().overlayEnabled }),
      isOverlayEnabled: () => settings.get().overlayEnabled,
      quit
    })

    app.on('activate', () => showApp(null))
  })

  app.on('before-quit', () => {
    quitting = true
    hotkey.dispose()
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
