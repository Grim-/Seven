import { screen, type BrowserWindow, type Rectangle } from 'electron'
import type { EventMessage } from '@shared/protocol'
import type { OverlayMode, OverlayPanel, OverlayState } from '@shared/types'
import { createOverlayWindow } from './app-window'
import { settings } from './settings'
import { clamp, fitOnScreen } from './windowState'

export const BUTTON_SIZE = 72
const ITEM_SIZE = 48
const TOOLBAR_PAD = 8
const GAP = 8
const MARGIN = 24
const PANELS: Record<OverlayPanel, { width: number; height: number }> = {
  chat: { width: 460, height: 700 },
  dashboard: { width: 780, height: 660 }
}

interface Anchor {
  right: boolean
  bottom: boolean
}


export class OverlayController {
  private win: BrowserWindow | null = null
  private mode: OverlayMode = 'button'
  private panel: OverlayPanel | null = null
  private items = 2
  private anchor: Anchor = { right: true, bottom: true }
  private dragTimer: NodeJS.Timeout | null = null

  constructor(private onEvent: (message: EventMessage) => void) {}

  get window(): BrowserWindow | null {
    return this.win && !this.win.isDestroyed() ? this.win : null
  }

  isExpanded(): boolean {
    return this.mode === 'panel'
  }

  state(): OverlayState {
    return { mode: this.mode, panel: this.panel, anchor: { ...this.anchor } }
  }

  private buttonStart(): Rectangle {
    const saved = settings.get().overlayPosition
    if (saved) {
      return fitOnScreen({ ...saved, width: BUTTON_SIZE, height: BUTTON_SIZE })
    }
    const area = screen.getPrimaryDisplay().workArea
    return {
      x: area.x + area.width - BUTTON_SIZE - MARGIN,
      y: area.y + area.height - BUTTON_SIZE - MARGIN,
      width: BUTTON_SIZE,
      height: BUTTON_SIZE
    }
  }

  show(): void {
    if (this.window) {
      this.window.showInactive()
      return
    }
    const win = createOverlayWindow()
    this.win = win
    this.mode = 'button'
    this.panel = null
    win.setBounds(this.buttonStart())
    win.once('ready-to-show', () => win.showInactive())
    win.on('closed', () => {
      if (this.win === win) this.win = null
      this.stopDrag()
    })
  }

  hide(): void {
    this.stopDrag()
    if (this.mode !== 'button') this.setMode('button', { focus: false })
    this.window?.hide()
  }

  resetPosition(): void {
    settings.set({ overlayPosition: null })
    const win = this.window
    if (!win) return
    if (this.mode !== 'button') this.setMode('button', { focus: false })
    win.setBounds(this.buttonStart())
  }

  setEnabled(enabled: boolean): void {
    if (enabled) this.show()
    else this.hide()
  }

  private buttonRect(bounds: Rectangle): Rectangle {
    if (this.mode === 'button') return { ...bounds, width: BUTTON_SIZE, height: BUTTON_SIZE }
    return {
      x: this.anchor.right ? bounds.x + bounds.width - BUTTON_SIZE : bounds.x,
      y: this.anchor.bottom ? bounds.y + bounds.height - BUTTON_SIZE : bounds.y,
      width: BUTTON_SIZE,
      height: BUTTON_SIZE
    }
  }

  setMode(mode: OverlayMode, options: { panel?: OverlayPanel | null; items?: number; focus?: boolean } = {}): OverlayState {
    const win = this.window
    if (!win) return this.state()
    if (typeof options.items === 'number') this.items = Math.max(1, Math.min(20, Math.round(options.items)))
    const panel = mode === 'panel' ? (options.panel ?? this.panel ?? 'chat') : null
    const button = this.buttonRect(win.getBounds())
    const area = screen.getDisplayMatching(button).workArea
    if (this.mode === 'button' && mode !== 'button') {
      const cx = button.x + BUTTON_SIZE / 2
      const cy = button.y + BUTTON_SIZE / 2
      this.anchor = { right: cx > area.x + area.width / 2, bottom: cy > area.y + area.height / 2 }
    }
    let width = BUTTON_SIZE
    let height = BUTTON_SIZE
    if (mode !== 'button') {
      const toolbarHeight = Math.min(BUTTON_SIZE + this.items * ITEM_SIZE + TOOLBAR_PAD, area.height - MARGIN)
      height = toolbarHeight
      if (panel) {
        const size = PANELS[panel]
        width = Math.min(BUTTON_SIZE + GAP + size.width, area.width - MARGIN * 2)
        height = Math.min(Math.max(toolbarHeight, size.height), area.height - MARGIN * 2)
      }
    }
    const x = this.anchor.right ? button.x + BUTTON_SIZE - width : button.x
    const y = this.anchor.bottom ? button.y + BUTTON_SIZE - height : button.y
    const wasExpanded = this.mode === 'panel'
    this.mode = mode
    this.panel = panel
    win.setResizable(true)
    win.setBounds({
      x: mode === 'button' ? x : clamp(x, area.x, area.x + area.width - width),
      y: mode === 'button' ? y : clamp(y, area.y, area.y + area.height - height),
      width,
      height
    })
    win.setResizable(false)
    if (mode === 'button') {
      settings.set({ overlayPosition: { x, y } })
      win.blur()
    } else if (options.focus) {
      win.show()
      win.focus()
    }
    if (wasExpanded !== (mode === 'panel')) this.onEvent({ event: 'overlay.expanded', payload: mode === 'panel' })
    this.onEvent({ event: 'overlay.state', payload: this.state() })
    return this.state()
  }

  setExpanded(expanded: boolean, focus: boolean): boolean {
    if (!this.window) return false
    if (expanded && this.mode === 'panel') {
      if (focus) this.window.focus()
      return true
    }
    this.setMode(expanded ? 'panel' : 'button', { panel: 'chat', focus })
    return this.mode === 'panel'
  }

  toggle(): void {
    if (!this.window || !this.window.isVisible()) {
      this.show()
      this.setExpanded(true, true)
      return
    }
    if (this.mode !== 'button' && !this.window.isFocused()) {
      this.window.focus()
      return
    }
    if (this.mode === 'button') this.setExpanded(true, true)
    else this.setMode('button', { focus: false })
  }

  dragStart(): void {
    const win = this.window
    if (!win) return
    this.stopDrag()
    const cursor = screen.getCursorScreenPoint()
    const [wx, wy] = win.getPosition()
    const offset = { x: cursor.x - wx, y: cursor.y - wy }
    this.dragTimer = setInterval(() => {
      if (!this.window) return this.stopDrag()
      const p = screen.getCursorScreenPoint()
      this.window.setPosition(p.x - offset.x, p.y - offset.y)
    }, 16)
  }

  dragEnd(): void {
    this.stopDrag()
    const win = this.window
    if (!win || this.mode !== 'button') return
    const [x, y] = win.getPosition()
    settings.set({ overlayPosition: { x, y } })
  }

  private stopDrag(): void {
    if (this.dragTimer) clearInterval(this.dragTimer)
    this.dragTimer = null
  }
}
