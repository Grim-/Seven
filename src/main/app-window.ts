import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { Channel, type EventMessage } from '@shared/protocol'
import { defaultBounds, keepWindowState, loadWindowState } from './windowState'

export type RendererMode = 'app' | 'overlay'

const preload = join(import.meta.dirname, '../preload/index.mjs')

function loadRenderer(win: BrowserWindow, mode: RendererMode): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?mode=${mode}`)
  } else {
    void win.loadFile(join(import.meta.dirname, '../renderer/index.html'), { query: { mode } })
  }
}

function denyPopups(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })
}

export function createAppWindow(options: { show: boolean; onEvent: (message: EventMessage) => void }): BrowserWindow {
  const state = loadWindowState()
  const win = new BrowserWindow({
    ...(state?.bounds ?? defaultBounds()),
    minWidth: 960,
    minHeight: 600,
    show: false,
    frame: false,
    backgroundColor: '#090a0d',
    title: 'Seven',
    webPreferences: { preload, sandbox: false, plugins: true, webviewTag: true }
  })

  if (options.show)
    win.once('ready-to-show', () => {
      if (state?.maximized) win.maximize()
      else win.show()
      if (state?.minimized) win.minimize()
    })
  else if (state?.maximized) win.once('show', () => win.maximize())
  keepWindowState(win)
  win.on('maximize', () => options.onEvent({ event: 'window.maximized', payload: true }))
  win.on('unmaximize', () => options.onEvent({ event: 'window.maximized', payload: false }))
  denyPopups(win)
  loadRenderer(win, 'app')
  return win
}

export function createOverlayWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 72,
    height: 72,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: 'Seven Overlay',
    webPreferences: { preload, sandbox: false, plugins: true }
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  denyPopups(win)
  loadRenderer(win, 'overlay')
  return win
}

export function broadcast(message: EventMessage): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(Channel.event, message)
  }
}
