import { registerBackgroundDrawer } from './drawers'
import { BaseBackground } from './base'

type Rgb = [number, number, number]

const SKY_DARK: Rgb[] = [
  [5, 1, 20],
  [26, 0, 51],
  [51, 0, 51]
]
const SKY_PEAK: Rgb[] = [
  [30, 0, 60],
  [120, 0, 100],
  [255, 0, 85]
]
const LAYERS = [
  { speed: 2, blur: 1, minH: 70, maxH: 150, minW: 80, maxW: 160, gap: 5 },
  { speed: 5, blur: 2, minH: 100, maxH: 160, minW: 40, maxW: 100, gap: 10 },
  { speed: 8, blur: 5, minH: 40, maxH: 110, minW: 30, maxW: 80, gap: 15 }
]
const PAD = 12
const ANTENNA = 40
const MOON_GLOW = 30
const CYCLE_MS = 600000
const TRAIL = { speed: 40, length: 60, thickness: 1, alpha: 0.9, yOffset: 4 }
const MOONRISE_MS = 8000

interface Strip {
  canvas: HTMLCanvasElement
  width: number
  speed: number
}

interface Star {
  x: number
  y: number
  size: number
  blink: number
}

interface Trail {
  start: number
  speed: number
  length: number
  thickness: number
  color: Rgb
}

function lerp(a: Rgb, b: Rgb, t: number): string {
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)}, ${Math.round(a[1] + (b[1] - a[1]) * t)}, ${Math.round(a[2] + (b[2] - a[2]) * t)})`
}

export class NeonCityBackground extends BaseBackground {
  private horizon = 0
  private strips: Strip[] = []
  private stars: Star[] = []
  private moon: HTMLCanvasElement | null = null
  private scan: CanvasPattern | null = null
  private extra: Trail[] = []
  private moonriseAt = -Infinity

  protected onResize(): void {
    this.horizon = this.height * 0.95
    this.buildStrips()
    this.buildStars()
    this.buildMoon()
    this.buildScan()
  }

  protected onSettings(): void {
    if (!this.width) return
    if (this.stars.length !== Math.round(this.num('starCount', 150))) this.buildStars()
    this.buildMoon()
  }

  protected onReaction(name: string): void {
    const now = performance.now()
    if (name === 'light_trail') this.extra.push({ start: now, speed: 900, length: 140, thickness: 2, color: [0, 255, 255] })
    if (name === 'moonrise') this.moonriseAt = now
  }

  private buildStrips(): void {
    this.strips = LAYERS.map((layer) => {
      const total = Math.max(this.width * 2, 1600)
      const canvas = document.createElement('canvas')
      const height = layer.maxH + ANTENNA + PAD * 2
      canvas.width = total + PAD * 2
      canvas.height = height
      const c = canvas.getContext('2d')!
      c.filter = layer.blur > 0 ? `blur(${layer.blur}px)` : 'none'
      c.strokeStyle = '#000000'
      c.lineWidth = 1
      const floor = height - PAD
      let x = 0
      while (x < total) {
        const w = Math.random() * (layer.maxW - layer.minW) + layer.minW
        const h = Math.random() * (layer.maxH - layer.minH) + layer.minH
        const shade = 2 + Math.floor(Math.random() * 3)
        const at = Math.min(x, total - w)
        c.fillStyle = `rgb(${shade}, ${shade}, ${shade + 5})`
        c.fillRect(PAD + at, floor - h, w, h)
        c.strokeRect(PAD + at, floor - h, w, h)
        if (Math.random() > 0.6) {
          c.beginPath()
          c.moveTo(PAD + at + w / 2, floor - h)
          c.lineTo(PAD + at + w / 2, floor - h - (Math.random() * 30 + 10))
          c.stroke()
        }
        x += w + Math.random() * layer.gap
      }
      return { canvas, width: total, speed: layer.speed }
    })
  }

  private buildStars(): void {
    const count = Math.round(this.num('starCount', 150))
    this.stars = Array.from({ length: count }, () => ({ x: Math.random() * this.width, y: Math.random() * this.horizon, size: Math.random() * 3.5, blink: Math.random() * 0.003 }))
  }

  private buildMoon(): void {
    const r = this.num('moonRadius', 100)
    const color = this.str('moonColor', '#1ccaed')
    const size = Math.ceil((r + MOON_GLOW * 2) * 2)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const c = canvas.getContext('2d')!
    c.shadowBlur = MOON_GLOW
    c.shadowColor = color
    c.fillStyle = color
    c.beginPath()
    c.arc(size / 2, size / 2, r, 0, Math.PI * 2)
    c.fill()
    this.moon = canvas
  }

  private buildScan(): void {
    const tile = document.createElement('canvas')
    tile.width = 1
    tile.height = 4
    const c = tile.getContext('2d')!
    c.fillStyle = 'rgba(0,0,0,0.2)'
    c.fillRect(0, 0, 1, 2)
    this.scan = this.ctx.createPattern(tile, 'repeat')
  }

  private elevation(time: number, now: number): number {
    const base = Math.sin(((time % CYCLE_MS) / CYCLE_MS) * Math.PI)
    const since = now - this.moonriseAt
    if (since < 0 || since > MOONRISE_MS) return base
    const rise = Math.min(1, since / 1500)
    const fall = Math.min(1, (MOONRISE_MS - since) / 2500)
    const boost = Math.min(rise, fall)
    return base + (1 - base) * boost
  }

  protected onFrame(_dt: number, time: number): void {
    const ctx = this.ctx
    const now = performance.now()
    const elev = this.elevation(time, now)
    this.sky(ctx, elev)
    this.drawStars(ctx, time, elev)
    this.drawMoon(ctx, elev)
    this.city(ctx, time)
    this.trail(ctx, time, [250, 255, 0])
    this.trail(ctx, time + 9000, [250, 0, 0])
    this.extraTrails(ctx, now)
    ctx.fillStyle = '#020205'
    ctx.fillRect(0, this.horizon, this.width, this.height - this.horizon)
    if (this.scan) {
      ctx.fillStyle = this.scan
      ctx.fillRect(0, 0, this.width, this.height)
    }
  }

  private sky(ctx: CanvasRenderingContext2D, elev: number): void {
    const g = ctx.createLinearGradient(0, 0, 0, this.horizon)
    g.addColorStop(0, lerp(SKY_DARK[0], SKY_PEAK[0], elev))
    g.addColorStop(0.5, lerp(SKY_DARK[1], SKY_PEAK[1], elev))
    g.addColorStop(1, lerp(SKY_DARK[2], SKY_PEAK[2], elev))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, this.width, this.height)
  }

  private drawStars(ctx: CanvasRenderingContext2D, time: number, elev: number): void {
    ctx.fillStyle = 'white'
    const dim = 1 - elev * 0.5
    for (const s of this.stars) {
      ctx.globalAlpha = ((Math.sin(time * s.blink) + 1) / 2) * dim
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private drawMoon(ctx: CanvasRenderingContext2D, elev: number): void {
    if (!this.moon) return
    const r = this.num('moonRadius', 100)
    const x = this.width * 0.5
    const y = this.horizon + r + 50 - elev * 700
    ctx.drawImage(this.moon, x - this.moon.width / 2, y - this.moon.height / 2)
    ctx.fillStyle = '#000000'
    for (let i = 0; i < 6; i++) ctx.fillRect(x - r, y + i * 15, r * 2, 2 + i * 1.5)
  }

  private city(ctx: CanvasRenderingContext2D, time: number): void {
    const speed = this.num('speed', 1)
    for (const s of this.strips) {
      const offset = ((time / 1000) * s.speed * speed) % s.width
      const y = this.horizon - s.canvas.height + PAD
      ctx.drawImage(s.canvas, -offset - PAD, y)
      if (s.width - offset < this.width) ctx.drawImage(s.canvas, s.width - offset - PAD, y)
    }
  }

  private line(ctx: CanvasRenderingContext2D, head: number, length: number, thickness: number, color: Rgb, alpha: number): void {
    const y = this.horizon - TRAIL.yOffset
    const tail = head - length
    const rgb = color.join(',')
    const g = ctx.createLinearGradient(tail, y, head, y)
    g.addColorStop(0, `rgba(${rgb}, 0)`)
    g.addColorStop(1, `rgba(${rgb}, ${alpha})`)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = g
    ctx.shadowColor = `rgb(${rgb})`
    ctx.shadowBlur = thickness * 6
    ctx.lineWidth = thickness
    ctx.beginPath()
    ctx.moveTo(tail, y)
    ctx.lineTo(head, y)
    ctx.stroke()
    ctx.restore()
  }

  private trail(ctx: CanvasRenderingContext2D, time: number, color: Rgb): void {
    const span = this.width + TRAIL.length
    const head = (((time / 1000) * TRAIL.speed) % span) - TRAIL.length
    this.line(ctx, head, TRAIL.length, TRAIL.thickness, color, TRAIL.alpha)
  }

  private extraTrails(ctx: CanvasRenderingContext2D, now: number): void {
    this.extra = this.extra.filter((t) => {
      const head = ((now - t.start) / 1000) * t.speed - t.length
      if (head - t.length > this.width) return false
      this.line(ctx, head, t.length, t.thickness, t.color, 1)
      return true
    })
  }
}

registerBackgroundDrawer('neon-city', NeonCityBackground)
