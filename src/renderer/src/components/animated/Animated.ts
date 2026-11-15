import { startTicking, stopTicking, type Ticking } from './loop'

export interface AnimatedColors {
  accent: string
  secondary: string
  base: string
}

const FRAME_MS = 1000 / 30

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export abstract class Animated<S> implements Ticking {
  canvas: HTMLCanvasElement | null = null
  ctx!: CanvasRenderingContext2D
  width = 0
  height = 0
  colors: AnimatedColors
  settings: S
  protected opaque = false
  private lastDraw = 0
  private running = false

  constructor(colors: AnimatedColors, settings: S) {
    this.colors = colors
    this.settings = settings
  }

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: !this.opaque })!
    this.onMount()
    this.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight)
  }

  start(): void {
    this.running = true
    this.lastDraw = performance.now()
    this.schedule()
  }

  stop(): void {
    this.running = false
    stopTicking(this)
  }

  dispose(): void {
    this.stop()
    this.onDispose()
    this.canvas = null
  }

  refresh(): void {
    if (this.running && this.still()) this.drawNow()
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width))
    const h = Math.max(1, Math.round(height))
    if (w === this.width && h === this.height) return
    this.width = w
    this.height = h
    const ratio = this.pixelRatio()
    if (this.canvas) {
      this.canvas.width = Math.round(w * ratio)
      this.canvas.height = Math.round(h * ratio)
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    this.onResize()
    if (this.running) this.schedule()
  }

  setColors(colors: AnimatedColors): void {
    this.colors = colors
    this.onColors()
    this.refresh()
  }

  setSettings(settings: S): void {
    this.settings = settings
    this.onSettings()
    this.refresh()
  }

  react(name: string, detail?: Record<string, unknown>): void {
    this.onReaction(name, detail)
  }

  protected reschedule(): void {
    if (this.running) this.schedule()
  }

  tick(time: number): void {
    if (time - this.lastDraw < FRAME_MS - 2) return
    const dt = Math.min((time - this.lastDraw) / 1000, 0.25)
    this.lastDraw = time
    this.onFrame(dt, time)
  }

  pause(time: number): void {
    this.lastDraw = time
  }

  protected still(): boolean {
    return reducedMotion()
  }

  protected pixelRatio(): number {
    return 1
  }

  private schedule(): void {
    if (!this.still()) return startTicking(this)
    stopTicking(this)
    this.drawNow()
  }

  private drawNow(): void {
    if (this.canvas) this.onFrame(0, performance.now())
  }

  protected onMount(): void {}
  protected onDispose(): void {}
  protected onResize(): void {}
  protected onColors(): void {}
  protected onSettings(): void {}
  protected onReaction(_name: string, _detail?: Record<string, unknown>): void {}
  protected abstract onFrame(dt: number, time: number): void
}
