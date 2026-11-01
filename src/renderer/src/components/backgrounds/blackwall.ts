import { BaseBackground } from './base'
import { BLACKWALL_FACE } from './blackwallFace'

type Rgb = [number, number, number]

const STRIPE = 5
const GAP = 0.1
const CELL = STRIPE + GAP
const PRIMARY: Rgb = [255, 30, 40]
const SECONDARY: Rgb = [255, 120, 10]
const CORE: Rgb = [255, 240, 220]
const COOL: Rgb = [250, 144, 15]
const WARM: Rgb = [45, 10, 15]
const BRUISED: Rgb = [Math.floor(255 * 0.35), Math.floor(30 * 0.15), Math.floor(40 * 0.15)]
const HOT = { high: 0.8, mid: 0.45, low: 0.15 }
const NOISE = { x: 37.1, y: 83.3, seed: 19.1, amp: 43758.5453123, octaves: 3, offset: 10, lacunarity: 2.1, gain: 0.5 }
const BLEED = { max: 600, minSpeed: 2, maxSpeed: 6, width: 1.2, minLength: 40, maxLength: 190, reset: 200, minAlpha: 0.3, maxAlpha: 1 }
const PULSES = { max: 10, chance: 0.03, minLife: 90, maxLife: 200, opacity: 0.6, secondaryChance: 0.8, glow: 0.5, radius: 1.5 }
const BREACH = {
  max: 3,
  chance: 0.04,
  minRadius: 1,
  maxRadius: 9,
  spread: 1.5,
  minLobes: 3,
  maxLobes: 6,
  generations: 2,
  minChildren: 1,
  maxChildren: 3,
  delayMin: 15,
  delayMax: 50,
  childRadius: 0.9,
  childHeat: 0.7,
  noiseScale: 0.1,
  minCells: 12,
  minDuration: 30,
  maxDuration: 280,
  minDelay: 0.1,
  maxDelay: 1.8,
  padding: 30,
  opacity: 0.95,
  scale: 0.25,
  distortion: 1.45,
  warp: 6,
  heatCurve: 1.4,
  alphaCurve: 1.2,
  pulse: 0.3,
  shift: 0.4,
  squirm: 0.3,
  wobble: { speed: 0.013, intensity: 0.05, freq: 0.08, variance: 0.08, speedScale: 1.3, freqScale: 1.5 }
}
const MOLD = { max: 4, minRadius: 0.5, maxRadius: 2, generations: 3, opacity: 0.65, scale: 0.05 }
const FACE_LIFE = 420
const FACE_FADE = 40

interface Cell {
  col: number
  row: number
  delay: number
  heat: number
  weight: number
  dx: number
  dy: number
}

interface Child {
  col: number
  row: number
  delay: number
  spawned: boolean
}

interface Breach {
  subtle: boolean
  opacity: number
  scale: number
  generation: number
  radiusMult: number
  cells: Cell[]
  children: Child[]
  life: number
  maxLife: number
  duration: number
}

interface Pulse {
  col: number
  row: number
  life: number
  maxLife: number
  color: Rgb
}

interface Trail {
  x: number
  y: number
  speed: number
  length: number
  alpha: number
}

const between = (min: number, max: number) => min + Math.random() * (max - min)
const intBetween = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))

function smooth(x: number, y: number, seed: number): number {
  const n = Math.sin(x * NOISE.x + y * NOISE.y + seed * NOISE.seed) * NOISE.amp
  return n - Math.floor(n)
}

function organic(x: number, y: number, seed: number): number {
  let val = 0
  let freq = 1
  let amp = 1
  let total = 0
  for (let i = 0; i < NOISE.octaves; i++) {
    val += smooth(x * freq, y * freq, seed + i * NOISE.offset) * amp
    total += amp
    freq *= NOISE.lacunarity
    amp *= NOISE.gain
  }
  return val / total
}

function mix(a: Rgb, b: Rgb, t: number): string {
  return `${Math.round(a[0] + (b[0] - a[0]) * t)}, ${Math.round(a[1] + (b[1] - a[1]) * t)}, ${Math.round(a[2] + (b[2] - a[2]) * t)}`
}

function heatColor(heat: number): string {
  if (heat > HOT.high) return mix(SECONDARY, CORE, (heat - HOT.high) / (1 - HOT.high))
  if (heat > HOT.mid) return mix(PRIMARY, SECONDARY, (heat - HOT.mid) / (HOT.high - HOT.mid))
  if (heat > HOT.low) return mix(BRUISED, PRIMARY, (heat - HOT.low) / (HOT.mid - HOT.low))
  return mix(COOL, WARM, heat / HOT.low)
}

const HEAT_STEPS = 128
const HEAT = Array.from({ length: HEAT_STEPS + 1 }, (_, i) => heatColor(i / HEAT_STEPS))
const ALPHA_STEPS = 40
const STYLES: string[][] = HEAT.map(() => [])

function style(heat: number, alpha: number): string {
  const h = Math.round(Math.min(1, heat) * HEAT_STEPS)
  const a = Math.round(Math.min(1, alpha) * ALPHA_STEPS)
  return (STYLES[h][a] ??= `rgba(${HEAT[h]}, ${a / ALPHA_STEPS})`)
}

export class BlackwallBackground extends BaseBackground {
  private cols = 0
  private rows = 0
  private cage: HTMLCanvasElement | null = null
  private grid: HTMLCanvasElement | null = null
  private noise: CanvasPattern | null = null
  private vignette: CanvasGradient | null = null
  private streak: HTMLCanvasElement | null = null
  private face: HTMLCanvasElement | null = null
  private faceAt: { x: number; y: number } = { x: 0, y: 0 }
  private faceLife = -1
  private trails: Trail[] = []
  private pulses: Pulse[] = []
  private breaches: Breach[] = []
  private buckets = new Map<string, number[]>()

  protected onResize(): void {
    const w = this.width
    const h = this.height
    this.cols = Math.ceil(w / CELL) + 1
    this.rows = Math.ceil(h / CELL) + 1

    const cage = document.createElement('canvas')
    cage.width = w
    cage.height = h
    const c = cage.getContext('2d')!
    c.fillStyle = 'rgb(8, 2, 4)'
    c.fillRect(0, 0, w, h)
    for (let x = 0; x < w; x += CELL) {
      const g = c.createLinearGradient(x, 0, x + STRIPE, 0)
      g.addColorStop(0, 'rgba(0,0,0,0.95)')
      g.addColorStop(0.5, 'rgba(25, 4, 8, 0.4)')
      g.addColorStop(1, 'rgba(0,0,0,0.95)')
      c.fillStyle = g
      c.fillRect(x, 0, STRIPE, h)
    }
    this.cage = cage

    const grid = document.createElement('canvas')
    grid.width = w
    grid.height = h
    const gc = grid.getContext('2d')!
    for (let col = 0; col < this.cols; col++) {
      const x = col * CELL
      gc.fillStyle = 'rgb(0, 255, 255)'
      gc.fillRect(x, 0, STRIPE, h)
      gc.fillStyle = 'rgba(0, 255, 255, 0.4)'
      gc.fillRect(x + STRIPE, 0, GAP, h)
    }
    for (let row = 0; row < this.rows; row++) gc.clearRect(0, row * CELL + CELL - 1, w, 1)
    this.grid = grid

    const tile = document.createElement('canvas')
    tile.width = 128
    tile.height = 128
    const tc = tile.getContext('2d')!
    const img = tc.createImageData(128, 128)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255
      img.data[i] = v > 210 ? 180 : 15
      img.data[i + 1] = 0
      img.data[i + 2] = v > 240 ? 40 : 0
      img.data[i + 3] = Math.random() * 45
    }
    tc.putImageData(img, 0, 0)
    this.noise = this.ctx.createPattern(tile, 'repeat')

    const v = this.ctx.createRadialGradient(w / 2, h / 2, h * 0.4, w / 2, h / 2, h)
    v.addColorStop(0, 'rgba(0,0,0,0)')
    v.addColorStop(1, 'rgba(0,0,0,0.75)')
    this.vignette = v

    if (!this.streak) {
      const s = document.createElement('canvas')
      s.width = 2
      s.height = 256
      const sc = s.getContext('2d')!
      const g = sc.createLinearGradient(0, 0, 0, 256)
      g.addColorStop(0, 'rgba(255, 30, 40, 0)')
      g.addColorStop(1, 'rgba(255, 30, 40, 0.2)')
      sc.fillStyle = g
      sc.fillRect(0, 0, 2, 256)
      this.streak = s
    }

    this.face = null
    this.faceLife = -1
    this.trails = []
    this.pulses = []
    this.breaches = []
  }

  protected onReaction(name: string): void {
    if (name === 'breach' && this.cols) {
      this.spawnBreach(Math.floor(Math.random() * this.cols), Math.floor(Math.random() * this.rows), 0, 1, false, true)
      this.spawnBreach(Math.floor(Math.random() * this.cols), Math.floor(Math.random() * this.rows), 0, 1, false, true)
    }
    if (name === 'face') this.faceLife = 0
  }

  private trailX(col: number): number {
    return col * CELL + STRIPE + GAP / 2 - BLEED.width / 2
  }

  private spawnBreach(col: number, row: number, generation: number, radiusMult: number, subtle: boolean, forced = false): void {
    const profile = subtle
      ? { minRadius: MOLD.minRadius, maxRadius: MOLD.maxRadius, opacity: MOLD.opacity, scale: MOLD.scale, generations: MOLD.generations, max: MOLD.max }
      : { minRadius: BREACH.minRadius, maxRadius: BREACH.maxRadius, opacity: BREACH.opacity, scale: BREACH.scale, generations: BREACH.generations, max: BREACH.max }
    if (generation === 0 && !forced && this.breaches.filter((b) => b.generation === 0 && b.subtle === subtle).length >= profile.max) return

    const seed = Math.random() * 10000
    const radius = (forced ? between(profile.maxRadius * 0.7, profile.maxRadius) : between(profile.minRadius, profile.maxRadius)) * radiusMult
    const spread = radius * BREACH.spread
    const attack = Math.random()
    const duration = BREACH.minDuration + attack * (BREACH.maxDuration - BREACH.minDuration)
    const perCell = BREACH.minDelay + attack * (BREACH.maxDelay - BREACH.minDelay)

    const lobeCount = intBetween(BREACH.minLobes, BREACH.maxLobes)
    const lobes = Array.from({ length: lobeCount }, (_, l) => {
      const angle = (l / lobeCount) * Math.PI * 2 + seed
      const dist = spread * 0.4 * (0.5 + Math.sin(seed + l) * 0.5)
      return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, weight: 0.7 + (l % 2) * 0.3 }
    })

    const cells: Cell[] = []
    const hot: { col: number; row: number }[] = []
    let maxDelay = 0
    const box = Math.ceil(spread * 1.5)
    for (let dr = -box; dr <= box; dr++) {
      for (let dc = -box; dc <= box; dc++) {
        const c = col + dc
        const r = row + dr
        if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) continue
        let nearest = Infinity
        for (const lobe of lobes) {
          const d = Math.hypot(dc - lobe.x, dr - lobe.y) / lobe.weight
          if (d < nearest) nearest = d
        }
        const warped = nearest + (organic(c * BREACH.noiseScale, r * BREACH.noiseScale, seed) - 0.5) * BREACH.warp
        const norm = Math.max(0, warped / spread)
        if (norm > 1) continue
        const heat = Math.pow(1 - norm, BREACH.heatCurve)
        const delay = norm * spread * perCell
        cells.push({ col: c, row: r, delay, heat, weight: Math.pow(heat, BREACH.alphaCurve), dx: (dc / (spread || 1)) * BREACH.distortion, dy: (dr / (spread || 1)) * BREACH.distortion })
        if (delay > maxDelay) maxDelay = delay
        if (heat >= BREACH.childHeat) hot.push({ col: c, row: r })
      }
    }
    if (cells.length < BREACH.minCells) return

    const children: Child[] = []
    if (generation < profile.generations && hot.length) {
      const n = intBetween(BREACH.minChildren, BREACH.maxChildren)
      for (let i = 0; i < n; i++) {
        const h = hot[Math.floor(Math.random() * hot.length)]
        children.push({ col: h.col, row: h.row, delay: between(BREACH.delayMin, BREACH.delayMax), spawned: false })
      }
    }
    this.breaches.push({ subtle, opacity: profile.opacity, scale: profile.scale, generation, radiusMult, cells, children, life: 0, maxLife: maxDelay + duration + BREACH.padding, duration })
  }

  private updateBreaches(k: number): void {
    for (let i = this.breaches.length - 1; i >= 0; i--) {
      const b = this.breaches[i]
      b.life += k
      for (const child of b.children) {
        if (child.spawned || b.life < child.delay) continue
        child.spawned = true
        this.spawnBreach(child.col, child.row, b.generation + 1, b.radiusMult * BREACH.childRadius, b.subtle)
      }
      if (b.life >= b.maxLife) this.breaches.splice(i, 1)
    }
  }

  private drawBreaches(ctx: CanvasRenderingContext2D, now: number, subtle: boolean): void {
    const w = BREACH.wobble
    for (const b of this.breaches) {
      if (b.subtle !== subtle) continue
      for (const cell of b.cells) {
        const local = b.life - cell.delay
        if (local < 0 || local > b.duration) continue
        const t = local / b.duration
        const base = Math.sin(t * Math.PI) * (1 - BREACH.pulse * Math.sin(t * Math.PI * 2))
        const idx = cell.row * this.cols + cell.col
        const squirm = Math.sin(now * w.speed + idx * w.freq)
        const active = Math.max(0, base * (1 + squirm * w.intensity))
        const alpha = active * b.opacity * cell.weight
        if (alpha < 0.0125) continue
        const wiggle = Math.cos(now * w.speed * w.speedScale + idx * w.freq * w.freqScale)
        const scale = 1 + active * b.scale * cell.heat + wiggle * w.variance * cell.heat * base
        const px = cell.col * CELL
        const py = cell.row * CELL
        const cx = px + CELL / 2 + cell.dx * active * CELL * BREACH.shift * (1 + squirm * BREACH.squirm)
        const cy = py + CELL / 2 + cell.dy * active * CELL * BREACH.shift * (1 - squirm * BREACH.squirm)
        const left = cx - (CELL / 2) * scale
        const top = cy - (CELL / 2) * scale
        this.queue(style(cell.heat * active, alpha), left, top, STRIPE * scale, CELL * scale)
      }
    }
    for (const [fill, rects] of this.buckets) {
      if (!rects.length) continue
      ctx.fillStyle = fill
      ctx.beginPath()
      for (let i = 0; i < rects.length; i += 4) ctx.rect(rects[i], rects[i + 1], rects[i + 2], rects[i + 3])
      ctx.fill()
      rects.length = 0
    }
  }

  private queue(fill: string, x: number, y: number, w: number, h: number): void {
    let rects = this.buckets.get(fill)
    if (!rects) {
      rects = []
      this.buckets.set(fill, rects)
    }
    rects.push(x, y, w, h)
  }

  private buildFace(): void {
    const lines = BLACKWALL_FACE
    const size = Math.max(6, Math.floor((this.height * 0.62) / lines.length))
    const probe = this.ctx
    probe.font = `${size}px monospace`
    const charW = probe.measureText('⣿').width
    const width = Math.ceil(charW * Math.max(...lines.map((l) => l.length))) + 20
    const height = size * lines.length + 20
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const c = canvas.getContext('2d')!
    c.font = `${size}px monospace`
    c.textBaseline = 'top'
    const g = c.createLinearGradient(0, 10, 0, height - 10)
    g.addColorStop(0, 'rgb(65, 30, 40)')
    g.addColorStop(1, 'rgb(255, 120, 10)')
    c.fillStyle = g
    c.shadowColor = 'rgba(0, 255, 255, 0.35)'
    c.shadowBlur = 4
    lines.forEach((line, i) => c.fillText(line, 10, 10 + i * size))
    this.face = canvas
    this.faceAt = { x: Math.round((this.width - width) / 2), y: Math.round((this.height - height) / 2) }
  }

  private drawFace(ctx: CanvasRenderingContext2D, k: number): void {
    if (this.faceLife < 0) return
    if (!this.face) this.buildFace()
    const face = this.face!
    this.faceLife += k
    if (this.faceLife > FACE_LIFE) {
      this.faceLife = -1
      return
    }
    const fade = Math.min(1, this.faceLife / FACE_FADE, (FACE_LIFE - this.faceLife) / FACE_FADE)
    ctx.globalAlpha = fade
    ctx.drawImage(face, this.faceAt.x, this.faceAt.y)
    ctx.globalAlpha = 1
    if (Math.random() < k) {
      const minCol = Math.max(0, Math.floor(this.faceAt.x / CELL))
      const maxCol = Math.min(this.cols - 1, Math.ceil((this.faceAt.x + face.width) / CELL))
      const minRow = Math.max(0, Math.floor(this.faceAt.y / CELL))
      const maxRow = Math.min(this.rows - 1, Math.ceil((this.faceAt.y + face.height) / CELL))
      this.spawnBreach(intBetween(minCol, maxCol), intBetween(minRow, maxRow), 0, 1, true)
    }
  }

  private pulsesStep(ctx: CanvasRenderingContext2D, k: number): void {
    if (this.pulses.length < PULSES.max && Math.random() < PULSES.chance * k)
      this.pulses.push({
        col: Math.floor(Math.random() * this.cols),
        row: Math.floor(Math.random() * this.rows),
        life: 0,
        maxLife: between(PULSES.minLife, PULSES.maxLife),
        color: Math.random() < PULSES.secondaryChance ? SECONDARY : PRIMARY
      })
    const radius = (CELL / 2) * PULSES.glow * PULSES.radius
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    this.pulses = this.pulses.filter((p) => {
      p.life += k
      if (p.life >= p.maxLife) return false
      const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * PULSES.opacity
      const x = p.col * CELL
      const cx = x + CELL / 2
      const cy = p.row * CELL + CELL / 2
      const rgb = p.color.join(', ')
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      g.addColorStop(0, `rgba(${rgb}, ${alpha})`)
      g.addColorStop(1, `rgba(${rgb}, 0)`)
      ctx.fillStyle = g
      ctx.fillRect(x, p.row * CELL - radius, STRIPE, radius * 2)
      return true
    })
    ctx.restore()
  }

  private bleed(ctx: CanvasRenderingContext2D, k: number): void {
    for (let n = Math.max(1, Math.round(k)); n > 0 && this.trails.length < BLEED.max; n--)
      this.trails.push({
        x: this.trailX(Math.floor(Math.random() * this.cols)),
        y: -Math.random() * this.height,
        speed: between(BLEED.minSpeed, BLEED.maxSpeed),
        length: between(BLEED.minLength, BLEED.maxLength),
        alpha: between(BLEED.minAlpha, BLEED.maxAlpha)
      })
    const streak = this.streak!
    for (const t of this.trails) {
      t.y += t.speed * k
      if (t.y - t.length > this.height) {
        t.y = -Math.random() * BLEED.reset
        t.x = this.trailX(Math.floor(Math.random() * this.cols))
      }
      ctx.globalAlpha = t.alpha
      ctx.drawImage(streak, t.x, t.y - t.length, BLEED.width, t.length)
    }
    ctx.globalAlpha = 1
  }

  protected onFrame(dt: number): void {
    const ctx = this.ctx
    if (!this.cage || !this.grid) return
    const k = dt * 60
    const now = Date.now()
    ctx.drawImage(this.cage, 0, 0)
    ctx.save()
    ctx.globalAlpha = 0.02 + ((Math.sin(now * 0.0015) + 1) / 2) * 0.021
    ctx.globalCompositeOperation = 'screen'
    ctx.drawImage(this.grid, 0, 0)
    ctx.restore()

    this.pulsesStep(ctx, k)
    if (Math.random() < BREACH.chance * k) this.spawnBreach(Math.floor(Math.random() * this.cols), Math.floor(Math.random() * this.rows), 0, 1, false)
    this.updateBreaches(k)
    this.drawBreaches(ctx, now, false)
    this.drawFace(ctx, k)
    this.drawBreaches(ctx, now, true)
    this.bleed(ctx, k)

    if (this.noise) {
      ctx.fillStyle = this.noise
      ctx.fillRect(0, 0, this.width, this.height)
    }
    if (this.vignette) {
      ctx.fillStyle = this.vignette
      ctx.fillRect(0, 0, this.width, this.height)
    }
  }
}
