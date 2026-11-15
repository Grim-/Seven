import { frameMedia, frameText, type FrameEntry } from '@shared/settingSpec'
import { BaseAvatar } from '../BaseAvatar'
import { registerAvatarDrawer } from '../drawers'
import type { AvatarSignals } from '../signals'

const BASE_PX = 28
const LINE = 1.15

function padded(frames: string[]): string[][] {
  const lines = frames.map((f) => f.split('\n'))
  const width = Math.max(1, ...lines.flat().map((l) => [...l].length))
  return lines.map((frame) =>
    frame.map((l) => {
      const gap = width - [...l].length
      const left = Math.floor(gap / 2)
      return ' '.repeat(left) + l + ' '.repeat(gap - left)
    })
  )
}

interface Layout {
  key: string
  entries: FrameEntry[]
  glances: FrameEntry[]
  lines: string[][]
  glanceLines: string[][]
  font: number
  chars: number
  rows: number
}

class GlyphAvatar extends BaseAvatar {
  private shown = ''
  private index = 0
  private elapsed = 0
  private glanceAt = 0
  private glanceUntil = 0
  private glance = 0
  private layout: Layout | null = null
  private mono = 'monospace'

  protected override onMount(): void {
    super.onMount()
    if (this.canvas) this.mono = getComputedStyle(this.canvas).fontFamily || 'monospace'
  }

  protected override onResize(): void {
    this.layout = null
  }

  protected override onSettings(): void {
    this.layout = null
  }

  private layoutFor(key: string | null): Layout {
    const id = key ?? ''
    if (this.layout?.key === id) return this.layout
    const entries = this.frames('frames', key)
    const glances = key ? [] : this.frames('blinks', null)
    const all = padded([...entries, ...glances].map(frameText))
    const chars = Math.max(1, ...all.flat().map((l) => [...l].length))
    const rows = Math.max(1, ...all.map((f) => f.length))
    const ctx = this.ctx
    ctx.font = `bold 100px ${this.mono}`
    const per = ctx.measureText('M').width / 100
    const font = Math.max(4, Math.min((this.width * 0.92) / (chars * per), (this.height * 0.9) / (rows * LINE)))
    this.layout = { key: id, entries, glances, lines: all.slice(0, entries.length), glanceLines: all.slice(entries.length), font, chars, rows }
    return this.layout
  }

  protected draw(dt: number, time: number, s: AvatarSignals): void {
    const key = this.poseKey(s)
    const layout = this.layoutFor(key)
    if (layout.key !== this.shown) {
      this.shown = layout.key
      this.index = 0
      this.elapsed = 0
      this.glanceAt = 0
      this.glanceUntil = 0
    }
    const speed = Math.max(16, this.num('speed', key) * (1 - s.rate * 0.4))
    this.elapsed += dt * 1000
    if (layout.entries.length > 1 && this.elapsed >= speed) {
      const steps = Math.floor(this.elapsed / speed)
      this.index = (this.index + steps) % layout.entries.length
      this.elapsed -= steps * speed
    }
    const framePos = this.index % layout.entries.length
    let entry = layout.entries[framePos]
    let lines = layout.lines[framePos]
    const every = this.num('blinkEvery', null)
    if (!key && every > 0 && layout.glances.length) {
      if (!this.glanceAt) this.glanceAt = time + every * 1000 * (0.5 + Math.random())
      if (!this.glanceUntil && time >= this.glanceAt) {
        this.glance = Math.floor(Math.random() * layout.glances.length)
        this.glanceUntil = time + this.num('blinkFor', null)
      }
      if (this.glanceUntil) {
        if (time < this.glanceUntil) {
          entry = layout.glances[this.glance]
          lines = layout.glanceLines[this.glance]
        } else {
          this.glanceUntil = 0
          this.glanceAt = time + every * 1000 * (0.5 + Math.random())
        }
      }
    }

    const ctx = this.ctx
    const clip = frameMedia(entry) || this.poseClip(key, 'frames')
    const hasMedia = this.paintMediaClip(clip, time, key)
    if (!hasMedia) ctx.clearRect(0, 0, this.width, this.height)
    if (hasMedia && !frameText(entry).trim()) return
    const unit = layout.font / BASE_PX
    const t = time / 1000
    const shake = this.num('shake', key) * unit
    const bob = this.num('bob', key) * unit
    const droop = this.num('droop', key) * unit
    const breathe = this.num('breathe', key)
    const pulse = this.num('pulse', key)
    const flicker = this.num('flicker', key)
    const dx = shake ? (Math.random() * 2 - 1) * shake : 0
    const dy = (shake ? (Math.random() * 2 - 1) * shake : 0) - bob * Math.abs(Math.sin(t * 3)) + droop * (0.6 + 0.4 * Math.sin(t * 0.8))
    const scale = 1 + breathe * Math.sin(t * 2)
    let alpha = pulse ? 0.2 + ((Math.sin(time * 0.005 * pulse) + 1) / 2) * 0.8 : 1
    if (flicker && Math.random() < flicker) alpha *= 0.25

    const color = this.color('color', key)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(this.width / 2 + dx, this.height / 2 + dy)
    ctx.scale(scale, scale)
    ctx.font = `bold ${layout.font}px ${this.mono}`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = this.num('glow', key) * unit
    const top = (-(lines.length - 1) * layout.font * LINE) / 2
    lines.forEach((line, i) => ctx.fillText(line, 0, top + i * layout.font * LINE))
    ctx.restore()
  }
}

registerAvatarDrawer('glyph', GlyphAvatar)
