import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { Channel, type EventMessage } from '@shared/protocol'
import { defaultBounds, keepWindowState, loadWindowState } from './windowState'
import { startColorsArg, type StartColors } from '@shared/startColors'
import icon from '../../build/icon.png?asset'

export type RendererMode = 'app'

const preload = join(import.meta.dirname, '../preload/index.mjs')

function loadRenderer(win: BrowserWindow): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

function denyPopups(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })
}

export function createAppWindow(options: { show: boolean; onEvent: (message: EventMessage) => void; startColors: StartColors | null }): BrowserWindow {
  const state = loadWindowState()
  const win = new BrowserWindow({
    ...(state?.bounds ?? defaultBounds()),
    minWidth: 960,
    minHeight: 600,
    show: false,
    frame: false,
    backgroundColor: options.startColors?.ground ?? '#090a0d',
    icon,
    title: 'Seven',
    webPreferences: { preload, sandbox: false, plugins: true, webviewTag: true, additionalArguments: options.startColors ? [startColorsArg(options.startColors)] : [] }
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
  loadRenderer(win)
  return win
}

export function broadcast(message: EventMessage): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(Channel.event, message)
  }
}
