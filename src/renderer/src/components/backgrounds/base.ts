export interface BackgroundColors {
  accent: string
  secondary: string
  base: string
}

export type BackgroundSettings = Record<string, number | string>

const FRAME_MS = 1000 / 30

export function rgbOf(hex: string): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

export abstract class BaseBackground {
  canvas: HTMLCanvasElement | null = null
  ctx!: CanvasRenderingContext2D
  width = 0
  height = 0
  colors: BackgroundColors
  settings: BackgroundSettings
  private frameId = 0
  private lastDraw = 0
  private running = false
  private still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(colors: BackgroundColors, settings: BackgroundSettings) {
    this.colors = colors
    this.settings = settings
  }

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false })!
    this.onMount()
    this.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.lastDraw = performance.now()
    if (this.still) this.onFrame(0, this.lastDraw)
    else this.frameId = requestAnimationFrame(this.tick)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.frameId)
  }

  dispose(): void {
    this.stop()
    this.onDispose()
    this.canvas = null
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width))
    const h = Math.max(1, Math.round(height))
    if (w === this.width && h === this.height) return
    this.width = w
    this.height = h
    if (this.canvas) {
      this.canvas.width = w
      this.canvas.height = h
    }
    this.onResize()
    if (this.still && this.running) this.onFrame(0, performance.now())
  }

  setColors(colors: BackgroundColors): void {
    this.colors = colors
    this.onColors()
  }

  setSettings(settings: BackgroundSettings): void {
    this.settings = settings
    this.onSettings()
  }

  react(name: string): void {
    this.onReaction(name)
  }

  num(name: string, fallback: number): number {
    const v = this.settings[name]
    return typeof v === 'number' ? v : fallback
  }

  str(name: string, fallback: string): string {
    const v = this.settings[name]
    return typeof v === 'string' ? v : fallback
  }

  private tick = (time: number): void => {
    if (!this.running) return
    this.frameId = requestAnimationFrame(this.tick)
    if (document.hidden) {
      this.lastDraw = time
      return
    }
    if (time - this.lastDraw < FRAME_MS - 2) return
    const dt = Math.min((time - this.lastDraw) / 1000, 0.25)
    this.lastDraw = time
    this.onFrame(dt, time)
  }

  protected onMount(): void {}
  protected onDispose(): void {}
  protected onResize(): void {}
  protected onColors(): void {}
  protected onSettings(): void {}
  protected onReaction(_name: string): void {}
  protected abstract onFrame(dt: number, time: number): void
}
