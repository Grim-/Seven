import fs from 'node:fs'
import path from 'node:path'
import { screen, type BrowserWindow, type Rectangle } from 'electron'
import { WINDOW_STATE_FILE } from '@shared/sealed'
import { dataDir } from './paths'

export interface WindowState {
  bounds: Rectangle
  maximized: boolean
  minimized: boolean
}

const file = path.join(dataDir, WINDOW_STATE_FILE)

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

export function fitOnScreen(rect: Rectangle): Rectangle {
  const area = screen.getDisplayMatching(rect).workArea
  const width = Math.min(rect.width, area.width)
  const height = Math.min(rect.height, area.height)
  return { x: clamp(rect.x, area.x, area.x + area.width - width), y: clamp(rect.y, area.y, area.y + area.height - height), width, height }
}

const DEFAULT_SIZE = { width: 1440, height: 900 }

export function defaultBounds(): Rectangle {
  const area = screen.getPrimaryDisplay().workArea
  return fitOnScreen({ ...DEFAULT_SIZE, x: area.x + Math.round((area.width - DEFAULT_SIZE.width) / 2), y: area.y + Math.round((area.height - DEFAULT_SIZE.height) / 2) })
}

export function resetWindow(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore()
  if (win.isMaximized()) win.unmaximize()
  win.setBounds(defaultBounds())
  win.show()
  win.focus()
}

function isRect(value: unknown): value is Rectangle {
  const r = value as Partial<Rectangle> | null
  return Boolean(r) && [r?.x, r?.y, r?.width, r?.height].every((n) => typeof n === 'number' && Number.isFinite(n)) && (r?.width ?? 0) > 0 && (r?.height ?? 0) > 0
}

export function loadWindowState(): WindowState | null {
  let raw: Partial<WindowState>
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<WindowState>
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') console.error(`Could not read ${WINDOW_STATE_FILE}; the window opens at its default place`, err)
    return null
  }
  if (!isRect(raw?.bounds)) return null
  return { bounds: fitOnScreen(raw.bounds), maximized: raw.maximized === true, minimized: raw.minimized === true }
}

export function keepWindowState(win: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null
  const save = () => {
    if (timer) clearTimeout(timer)
    timer = null
    if (win.isDestroyed()) return
    const state: WindowState = { bounds: win.getNormalBounds(), maximized: win.isMaximized(), minimized: win.isMinimized() }
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8')
  }
  const later = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(save, 500)
  }
  const refit = () => {
    if (win.isDestroyed() || win.isMaximized()) return
    const now = win.getBounds()
    const fit = fitOnScreen(now)
    if (fit.x !== now.x || fit.y !== now.y || fit.width !== now.width || fit.height !== now.height) win.setBounds(fit)
  }
  win.on('move', later)
  win.on('resize', later)
  win.on('maximize', save)
  win.on('unmaximize', save)
  win.on('minimize', save)
  win.on('restore', save)
  win.on('close', save)
  screen.on('display-removed', refit)
  screen.on('display-metrics-changed', refit)
  win.on('closed', () => {
    if (timer) clearTimeout(timer)
    screen.off('display-removed', refit)
    screen.off('display-metrics-changed', refit)
  })
}
