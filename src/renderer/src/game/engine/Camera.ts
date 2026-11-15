import { Container, Rectangle } from 'pixi.js'
import type { Point, Size } from '@shared/shapes'

export interface View {
  x: number
  y: number
  zoom: number
}

const MARGIN = 0.96
const SMOOTH = 14

export class Camera {
  readonly world = new Container()
  private view: View = { x: 0, y: 0, zoom: 1 }
  private target: View | null = null
  private area: Size = { w: 1, h: 1 }
  private screen: Size = { w: 1, h: 1 }
  onSettle: (view: View) => void = () => {}
  onWake?: () => void

  get animating(): boolean {
    return this.target !== null
  }

  get zoom(): number {
    return this.view.zoom
  }

  get current(): View {
    return { ...this.view }
  }

  setArea(area: Size): void {
    this.area = area
  }

  setScreen(screen: Size): void {
    this.screen = screen
  }

  fitView(): View {
    const zoom = Math.min(this.screen.w / this.area.w, this.screen.h / this.area.h) * MARGIN
    return { zoom, x: (this.screen.w - this.area.w * zoom) / 2, y: (this.screen.h - this.area.h * zoom) / 2 }
  }

  private clampZoom(zoom: number): number {
    const fit = this.fitView().zoom
    return Math.min(fit * 40, Math.max(fit / 4, zoom))
  }

  set(view: View, animate = false): void {
    const next = { ...view, zoom: this.clampZoom(view.zoom) }
    if (animate) {
      this.target = next
      this.onWake?.()
      return
    }
    this.target = null
    this.view = next
    this.apply()
    this.onWake?.()
    this.onSettle(this.current)
  }

  fit(animate = true): void {
    this.set(this.fitView(), animate)
  }

  zoomAt(factor: number, at: Point, animate = true): void {
    const from = this.target ?? this.view
    const zoom = this.clampZoom(from.zoom * factor)
    const k = zoom / from.zoom
    this.set({ zoom, x: at.x - (at.x - from.x) * k, y: at.y - (at.y - from.y) * k }, animate)
  }

  panBy(dx: number, dy: number): void {
    const from = this.target ?? this.view
    this.set({ ...from, x: from.x + dx, y: from.y + dy })
  }

  centerOn(point: Point, animate = true): void {
    const from = this.target ?? this.view
    this.set({ zoom: from.zoom, x: this.screen.w / 2 - point.x * from.zoom, y: this.screen.h / 2 - point.y * from.zoom }, animate)
  }

  toWorld(screen: Point): Point {
    return { x: (screen.x - this.view.x) / this.view.zoom, y: (screen.y - this.view.y) / this.view.zoom }
  }

  visible(): Rectangle {
    const a = this.toWorld({ x: 0, y: 0 })
    return new Rectangle(a.x, a.y, this.screen.w / this.view.zoom, this.screen.h / this.view.zoom)
  }

  update(dt: number): void {
    const t = this.target
    if (!t) return
    const k = 1 - Math.exp(-dt * SMOOTH)
    const v = this.view
    const next = { x: v.x + (t.x - v.x) * k, y: v.y + (t.y - v.y) * k, zoom: v.zoom + (t.zoom - v.zoom) * k }
    const close = Math.abs(next.x - t.x) < 0.5 && Math.abs(next.y - t.y) < 0.5 && Math.abs(next.zoom - t.zoom) < t.zoom * 0.001
    this.view = close ? t : next
    this.apply()
    this.onWake?.()
    if (close) {
      this.target = null
      this.onSettle(this.current)
    }
  }

  private apply(): void {
    this.world.position.set(this.view.x, this.view.y)
    this.world.scale.set(this.view.zoom)
  }
}
