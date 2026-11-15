import type { Application, Container } from 'pixi.js'
import type { Point } from '@shared/shapes'
import type { Camera } from './Camera'

export interface PointerHit {
  world: Point
  native: PointerEvent | MouseEvent
}

export interface Bound {
  tap?: (hit: PointerHit) => void
  menu?: (hit: PointerHit) => void
  drag?: { move: (world: Point) => void; drop: (world: Point) => void; cancel: () => void }
  cursor?: string
}

export interface Blank {
  tap?: (hit: PointerHit) => void
  menu?: (hit: PointerHit) => void
  hover?: (world: Point | null) => void
}

const SLOP = 3
const ZOOM_STEP = 1.25

interface Press {
  id: number
  start: Point
  last: Point
  bound: Bound | null
  moved: boolean
  pan: boolean
}

export class Input {
  private bound = new WeakMap<Container, Bound>()
  private press: Press | null = null
  blank: Blank = {}

  constructor(
    private app: Application,
    private camera: Camera,
    private onWake?: () => void
  ) {
    const el = app.canvas
    el.addEventListener('pointerdown', this.down)
    el.addEventListener('pointermove', this.move)
    el.addEventListener('pointerup', this.up)
    el.addEventListener('pointercancel', this.cancel)
    el.addEventListener('pointerleave', this.leave)
    el.addEventListener('wheel', this.wheel, { passive: false })
    el.addEventListener('contextmenu', this.menu)
  }

  bind(target: Container, handlers: Bound): void {
    target.eventMode = 'static'
    target.cursor = handlers.cursor ?? (handlers.drag ? 'grab' : 'pointer')
    this.bound.set(target, handlers)
  }

  unbind(target: Container): void {
    this.bound.delete(target)
  }

  destroy(): void {
    const el = this.app.canvas
    el.removeEventListener('pointerdown', this.down)
    el.removeEventListener('pointermove', this.move)
    el.removeEventListener('pointerup', this.up)
    el.removeEventListener('pointercancel', this.cancel)
    el.removeEventListener('pointerleave', this.leave)
    el.removeEventListener('wheel', this.wheel)
    el.removeEventListener('contextmenu', this.menu)
  }

  private screenOf(e: MouseEvent): Point {
    const r = this.app.canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  private boundAt(screen: Point): Bound | null {
    let target: Container | null = this.app.renderer.events.rootBoundary.hitTest(screen.x, screen.y)
    while (target) {
      const found = this.bound.get(target)
      if (found) return found
      target = target.parent
    }
    return null
  }

  private down = (e: PointerEvent): void => {
    this.onWake?.()
    if (e.button === 2) return
    const at = this.screenOf(e)
    const bound = e.button === 0 ? this.boundAt(at) : null
    this.press = { id: e.pointerId, start: at, last: at, bound, moved: false, pan: !bound?.drag }
    this.app.canvas.setPointerCapture(e.pointerId)
  }

  private move = (e: PointerEvent): void => {
    this.onWake?.()
    const at = this.screenOf(e)
    const p = this.press
    if (!p || p.id !== e.pointerId) {
      this.blank.hover?.(this.boundAt(at) ? null : this.camera.toWorld(at))
      return
    }
    if (!p.moved && Math.hypot(at.x - p.start.x, at.y - p.start.y) > SLOP) p.moved = true
    if (p.moved && p.pan) this.camera.panBy(at.x - p.last.x, at.y - p.last.y)
    if (p.moved && p.bound?.drag) p.bound.drag.move(this.camera.toWorld(at))
    p.last = at
  }

  private up = (e: PointerEvent): void => {
    this.onWake?.()
    const p = this.press
    if (!p || p.id !== e.pointerId) return
    this.press = null
    const at = this.screenOf(e)
    const hit = { world: this.camera.toWorld(at), native: e }
    if (p.moved && p.bound?.drag) return p.bound.drag.drop(hit.world)
    if (p.moved) return
    if (p.bound?.tap) return p.bound.tap(hit)
    if (!p.bound && e.button === 0) this.blank.tap?.(hit)
  }

  private cancel = (): void => {
    this.onWake?.()
    this.press?.bound?.drag?.cancel()
    this.press = null
  }

  private leave = (): void => {
    this.onWake?.()
    if (!this.press) this.blank.hover?.(null)
  }

  private wheel = (e: WheelEvent): void => {
    e.preventDefault()
    this.onWake?.()
    this.camera.zoomAt(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, this.screenOf(e))
  }

  private menu = (e: MouseEvent): void => {
    e.preventDefault()
    this.onWake?.()
    const at = this.screenOf(e)
    const hit = { world: this.camera.toWorld(at), native: e }
    const bound = this.boundAt(at)
    if (bound) bound.menu?.(hit)
    else this.blank.menu?.(hit)
  }
}
