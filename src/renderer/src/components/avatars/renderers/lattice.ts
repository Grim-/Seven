import { frameMedia, frameText } from '@shared/settingSpec'
import { BaseAvatar } from '../BaseAvatar'
import { registerAvatarDrawer } from '../drawers'
import type { AvatarSignals } from '../signals'

const W = 27
const H = 9
const CX = 13
const CY = 4
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1]
]
const VIRUS = ['#', '%', '&', '@', '$', '*', '!', '?', '/', '\\', ';', '=']
const DETAIL_PX = 96

type Level = 0 | 1 | 2 | 3

interface Cell {
  ch: string
  level: Level
}

const rnd = (x: number, y: number, t: number) => {
  const s = Math.sin(x * 12.9898 + y * 78.233 + t * 0.317) * 43758.5453
  return s - Math.floor(s)
}

class LatticeAvatar extends BaseAvatar {
  private beat = 0
  private elapsed = 0
  private tearRow = -1
  private tearShift = 0
  private shown = ''
  private mono = 'monospace'

  protected override onMount(): void {
    super.onMount()
    if (this.canvas) this.mono = getComputedStyle(this.canvas).fontFamily || 'monospace'
  }

  private grid(key: string | null): Cell[][] {
    const decay = this.num('decay', key)
    const noise = this.num('noise', key)
    const reach = this.num('reach', key)
    const flex = this.num('flex', key)
    const packets = this.flag('packets', key)
    const cores = this.frames('cores', key)
    const beat = this.beat
    const grid: Cell[][] = []
    for (let y = 0; y < H; y++) {
      const row: Cell[] = []
      for (let x = 0; x < W; x++) {
        let ch = y % 2 === 0 ? (x % 4 === 0 ? '┼' : '─') : x % 4 === 0 ? '│' : ' '
        let level: Level = 0
        if (rnd(x, y, Math.floor(beat / 3)) < decay) ch = ' '
        const v = rnd(y * 3, x * 5, beat)
        if (v > 1 - noise) {
          ch = VIRUS[Math.floor(v * 997) % VIRUS.length]
          level = 1
        }
        row.push({ ch, level })
      }
      grid.push(row)
    }
    DIRS.forEach(([dx, dy], di) => {
      const len = Math.max(1, Math.round(reach + Math.sin(beat * 0.3 + di * 0.8) * flex))
      const packet = packets ? (beat + di * 2) % (len + 4) : -1
      for (let i = 1; i <= len; i++) {
        const x = dy === 0 ? CX + dx * i * 2 : CX + dx * i
        const y = CY + dy * i
        if (x < 0 || x >= W || y < 0 || y >= H) break
        const ch = dx && dy ? (dx * dy > 0 ? '╲' : '╱') : dy === 0 ? '━' : '┃'
        grid[y][x] = { ch, level: i === packet ? 3 : 2 }
      }
    })
    grid[CY][CX] = { ch: frameText(cores[beat % cores.length]) || '╬', level: 3 }
    grid[CY][CX - 1] = { ch: '═', level: 2 }
    grid[CY][CX + 1] = { ch: '═', level: 2 }
    return grid
  }

  protected draw(dt: number, time: number, s: AvatarSignals): void {
    const key = this.poseKey(s)
    if ((key ?? '') !== this.shown) {
      this.shown = key ?? ''
      this.tearRow = -1
      this.tearShift = 0
    }
    const speed = Math.max(16, this.num('speed', key))
    this.elapsed += dt * 1000
    if (this.elapsed >= speed) {
      this.elapsed %= speed
      this.beat++
      const size = this.num('tearSize', key)
      const tearing = Math.random() < this.num('tear', key)
      this.tearRow = tearing ? Math.floor(Math.random() * H) : -1
      this.tearShift = tearing ? Math.random() * size * 2 - size : 0
    }

    const cores = this.frames('cores', key)
    const activeCore = cores[this.beat % cores.length]
    const clip = frameMedia(activeCore) || this.poseClip(key, 'cores')
    const hasMedia = this.paintMediaClip(clip, time, key)
    if (hasMedia) {
      if (this.flag('scanlines', null)) {
        this.ctx.fillStyle = 'rgba(0,0,0,0.45)'
        for (let y = 0; y < this.height; y += 3) this.ctx.fillRect(0, y, this.width, 1)
      }
      return
    }

    const net = this.color('net', key)
    const core = this.color('core', key)
    const virus = this.color('virus', key)
    const ctx = this.ctx
    const w = this.width
    const h = this.height
    const detail = Math.min(w, h) >= DETAIL_PX
    const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75)
    glow.addColorStop(0, `${net}22`)
    glow.addColorStop(1, '#04030a')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)

    const rows = H + (detail ? 2 : 0)
    ctx.font = `100px ${this.mono}`
    const per = (ctx.measureText('─').width / 100) * 1.05
    const font = Math.min((w * 0.9) / (W * per), (h * 0.88) / (rows * 1.25))
    const cell = font * per
    const line = font * 1.25
    const left = (w - W * cell) / 2
    const top = (h - rows * line) / 2 + line / 2
    ctx.font = `${font}px ${this.mono}`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'

    const grid = this.grid(key)
    const scale = font / 16
    const paints = [
      { alpha: 0.75, color: net, blur: 0 },
      { alpha: 0.9, color: virus, blur: 0 },
      { alpha: 0.85, color: core, blur: 8 },
      { alpha: 1, color: '#ffffff', blur: 16 }
    ]
    ctx.shadowColor = core
    grid.forEach((row, y) => {
      const shift = y === this.tearRow ? this.tearShift * scale : 0
      row.forEach((c, x) => {
        if (c.ch === ' ') return
        const paint = paints[c.level]
        ctx.globalAlpha = paint.alpha
        ctx.fillStyle = paint.color
        ctx.shadowBlur = paint.blur * scale
        ctx.fillText(c.ch, left + (x + 0.5) * cell + shift, top + y * line)
      })
    })
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0

    if (detail) {
      const y = top + (H + 0.8) * line
      ctx.font = `${font * 0.7}px ${this.mono}`
      ctx.textAlign = 'left'
      ctx.fillStyle = `${net}dd`
      ctx.fillText(this.text('tag', null), left, y)
      ctx.textAlign = 'right'
      ctx.fillStyle = core
      ctx.fillText(this.text('label', key), left + W * cell, y)
    }

    if (this.flag('scanlines', null)) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1)
    }
  }
}

registerAvatarDrawer('lattice', LatticeAvatar)
