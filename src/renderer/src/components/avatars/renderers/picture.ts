import { PICTURE_RENDERER } from '@shared/avatars'
import { isReactionPose } from '@shared/moods'
import { frameMedia, frameText } from '@shared/settingSpec'
import { BaseAvatar } from '../BaseAvatar'
import { registerAvatarDrawer } from '../drawers'
import { moodRgb } from '../moodColor'
import type { AvatarSignals } from '../signals'

const OVERSCAN = 1.06

class PictureAvatar extends BaseAvatar {
  protected override ownsMedia = true
  private shown = ''
  private index = 0
  private elapsed = 0

  protected draw(dt: number, time: number, s: AvatarSignals): void {
    const key = this.poseKey(s)
    if ((key ?? '') !== this.shown) {
      this.shown = key ?? ''
      this.index = 0
      this.elapsed = 0
    }
    const sequence = this.frames('frames', key, false)
    const speed = Math.max(40, this.num('speed', key) * (1 - s.rate * 0.4))
    this.elapsed += dt * 1000
    if (sequence.length > 1 && this.elapsed >= speed) {
      const steps = Math.floor(this.elapsed / speed)
      this.index = (this.index + steps) % sequence.length
      this.elapsed -= steps * speed
    }
    const entry = sequence.length ? sequence[this.index % sequence.length] : null
    const clip = (entry ? frameMedia(entry) : '') || this.text('picture', key) || this.text('picture', null)
    const caption = entry ? frameText(entry).trim() : ''
    const isOneShot = Boolean(key && (s.reaction?.kind === key || isReactionPose(key)))
    this.media.show(clip, time, { loop: !isOneShot, onEnded: () => this.clearReaction() })
    const ctx = this.ctx
    const w = this.width
    const h = this.height
    ctx.clearRect(0, 0, w, h)
    const t = time / 1000
    const m = this.num('motion', key) * (Math.min(w, h) < 40 ? 0.4 : 1)
    const unit = Math.min(w, h) / 64
    const energy = s.mood.energy * s.mood.strength
    const warmth = s.mood.warmth * s.mood.strength
    const shake = Math.max(0, energy - 0.5) * 4 * m * unit
    const bob = Math.max(0, warmth) * 2 * m * unit * Math.abs(Math.sin(t * 3))
    const droop = Math.max(0, -energy) * 3 * m * unit
    const lean = this.num('lean', null) * unit
    const ox = (s.gaze?.x ?? 0) * lean + (shake ? (Math.random() * 2 - 1) * shake : 0)
    const oy = (s.gaze?.y ?? 0) * lean - bob + droop + (shake ? (Math.random() * 2 - 1) * shake : 0)
    const scale = OVERSCAN * (1 + 0.015 * m * Math.sin(t * 2)) * (1 + 0.04 * m * s.rate * Math.abs(Math.sin(t * 14)))

    ctx.filter = `grayscale(${Math.max(0, -energy) * 0.6})`
    this.media.paint(ctx, w, h, time, { scale, ox, oy })
    ctx.filter = 'none'

    const amount = this.num('tint', key) * Math.min(1, Math.hypot(energy, warmth))
    if (amount > 0.01) {
      const rgb = moodRgb(energy, warmth)
      ctx.globalCompositeOperation = 'color'
      ctx.fillStyle = `rgba(${rgb.join(',')},${amount})`
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
    }

    const scan = this.num('scan', key)
    if (scan > 0) {
      const band = h / 3
      const y = ((t * 0.6) % 1) * (h + band) - band
      const g = ctx.createLinearGradient(0, y, 0, y + band)
      g.addColorStop(0, 'transparent')
      g.addColorStop(0.5, `${s.colors.secondary}${Math.round(scan * 255).toString(16).padStart(2, '0')}`)
      g.addColorStop(1, 'transparent')
      ctx.fillStyle = g
      ctx.fillRect(0, y, w, band)
    }

    if (caption) {
      const fs = Math.max(9, Math.min(w, h) * 0.16)
      ctx.save()
      ctx.font = `bold ${fs}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(0,0,0,0.9)'
      ctx.shadowBlur = Math.max(4, fs * 0.35)
      ctx.fillStyle = s.colors.accent
      ctx.fillText(caption, w / 2 + ox, h / 2 + oy)
      ctx.restore()
    }
  }
}

registerAvatarDrawer(PICTURE_RENDERER, PictureAvatar)
