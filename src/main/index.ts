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
import { setupBrowser } from './browser'
import { settings } from './settings'
import { Channel } from '@shared/protocol'
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
    registerIpc({ engine, overlay, hotkey, vault, showApp, quit })
    engine.on('event', broadcast)
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
    tray?.tray.destroy()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
