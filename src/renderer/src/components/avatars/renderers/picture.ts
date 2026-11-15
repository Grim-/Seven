import { PICTURE_RENDERER } from '@shared/avatars'
import { assetUrl, lookUpAsset, useData } from '../../../store/data'
import { noteFailure } from '../../../store/problems'
import { BaseAvatar } from '../BaseAvatar'
import { registerAvatarDrawer } from '../drawers'
import type { AvatarSignals } from '../signals'

type Media = HTMLImageElement | HTMLVideoElement

interface Shown {
  id: string
  media: Media
  at: number
}

const FADE_MS = 300
const RETRY_MS = 1000
const OVERSCAN = 1.06
const WARM = [74, 222, 128]
const BRIGHT = [250, 204, 21]
const HOT = [255, 30, 60]
const COLD = [60, 90, 170]

const mix = (a: number[], b: number[], p: number) => a.map((v, i) => Math.round(v + (b[i] - v) * p))

const imageCache = new Map<string, HTMLImageElement>()

function sizeOf(m: Media): [number, number] {
  return m instanceof HTMLVideoElement ? [m.videoWidth, m.videoHeight] : [m.naturalWidth, m.naturalHeight]
}

class PictureAvatar extends BaseAvatar {
  private current: Shown | null = null
  private previous: Shown | null = null
  private attemptedId = ''
  private lookedAt = 0
  private dropped = new WeakSet<Media>()

  private load(id: string): Media | null {
    const meta = useData.getState().assets.find((a) => a.id === id)
    if (!meta) {
      lookUpAsset(id, 'An agent avatar')
      return null
    }
    const url = assetUrl(meta)
    if (meta.kind === 'video') {
      const v = document.createElement('video')
      v.src = url
      v.muted = true
      v.loop = true
      v.playsInline = true
      v.onloadeddata = () => this.refresh()
      void v.play().catch((err: unknown) => {
        if (!this.dropped.has(v)) noteFailure('avatars', 'Could not play an avatar video')(err)
      })
      return v
    }
    const cached = imageCache.get(url)
    if (cached && cached.complete && cached.naturalWidth > 0) return cached
    const img = cached ?? new Image()
    if (!cached) {
      imageCache.set(url, img)
      img.src = url
    }
    img.addEventListener('load', () => this.refresh(), { once: true })
    return img
  }

  private show(id: string, time: number): void {
    if (!id || id === this.current?.id) return
    if (id === this.attemptedId && time - this.lookedAt < RETRY_MS) return
    this.attemptedId = id
    this.lookedAt = time
    const media = this.load(id)
    if (!media) return
    this.drop(this.previous)
    this.previous = this.current
    this.current = { id, media, at: time }
  }

  private drop(shown: Shown | null): void {
    if (shown?.media instanceof HTMLVideoElement) {
      this.dropped.add(shown.media)
      shown.media.pause()
      shown.media.removeAttribute('src')
      shown.media.load()
    }
  }

  protected override onDispose(): void {
    super.onDispose()
    this.drop(this.current)
    this.drop(this.previous)
    this.current = null
    this.previous = null
  }

  private paint(m: Media, alpha: number, scale: number, ox: number, oy: number): void {
    const [nw, nh] = sizeOf(m)
    if (!nw || !nh || alpha <= 0) return
    const k = Math.max(this.width / nw, this.height / nh) * scale
    const dw = nw * k
    const dh = nh * k
    this.ctx.globalAlpha = alpha
    this.ctx.drawImage(m, (this.width - dw) / 2 + ox, (this.height - dh) / 2 + oy, dw, dh)
  }

  protected draw(_dt: number, time: number, s: AvatarSignals): void {
    const key = this.poseKey(s)
    this.show(this.text('picture', key) || this.text('picture', null), time)
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
    const p = this.current ? (this.previous ? Math.min(1, (time - this.current.at) / FADE_MS) : 1) : 0
    if (this.previous && p < 1) this.paint(this.previous.media, 1 - p, scale, ox, oy)
    if (this.current) this.paint(this.current.media, p, scale, ox, oy)
    ctx.filter = 'none'
    ctx.globalAlpha = 1

    const amount = this.num('tint', key) * Math.min(1, Math.hypot(energy, warmth))
    if (amount > 0.01) {
      const rgb = warmth >= 0 ? mix(WARM, BRIGHT, Math.max(0, energy)) : energy >= 0 ? HOT : COLD
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
  }
}

registerAvatarDrawer(PICTURE_RENDERER, PictureAvatar)
