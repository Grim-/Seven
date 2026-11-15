import { assetUrl, lookUpAsset, useData } from '../../store/data'
import { noteFailure } from '../../store/problems'

export type MediaElement = HTMLImageElement | HTMLVideoElement

interface Shown {
  id: string
  media: MediaElement
  at: number
}

const DEFAULT_FADE_MS = 300
const RETRY_MS = 1000

const imageCache = new Map<string, HTMLImageElement>()

function mediaSize(m: MediaElement): [number, number] {
  return m instanceof HTMLVideoElement ? [m.videoWidth, m.videoHeight] : [m.naturalWidth, m.naturalHeight]
}

export class MediaLayer {
  private current: Shown | null = null
  private previous: Shown | null = null
  private videos = new Map<string, HTMLVideoElement>()
  private dropped = new WeakSet<HTMLVideoElement>()
  private attemptedId = ''
  private lookedAt = 0
  private ended: (() => void) | null = null

  constructor(private readonly onReady: () => void) {}

  get activeId(): string {
    return this.current?.id ?? ''
  }

  get hasContent(): boolean {
    return Boolean(this.current || this.previous)
  }

  private loadVideo(id: string, url: string, loop: boolean): HTMLVideoElement {
    let video = this.videos.get(id)
    if (!video) {
      video = document.createElement('video')
      video.src = url
      video.muted = true
      video.playsInline = true
      video.onloadeddata = () => this.onReady()
      this.videos.set(id, video)
    }
    video.loop = loop
    video.onended = () => {
      if (!video?.loop) this.ended?.()
    }
    if (!loop && video.readyState >= 1) video.currentTime = 0
    if (video.paused) {
      void video.play().catch((err: unknown) => {
        if (!this.dropped.has(video!)) noteFailure('avatars', 'Could not play an avatar video')(err)
      })
    }
    return video
  }

  private load(id: string, loop: boolean): MediaElement | null {
    const meta = useData.getState().assets.find((a) => a.id === id)
    if (!meta) {
      lookUpAsset(id, 'An agent avatar')
      return null
    }
    const url = assetUrl(meta)
    if (meta.kind === 'video') return this.loadVideo(id, url, loop)
    const cached = imageCache.get(url)
    if (cached && cached.complete && cached.naturalWidth > 0) return cached
    const img = cached ?? new Image()
    if (!cached) {
      imageCache.set(url, img)
      img.src = url
    }
    img.addEventListener('load', () => this.onReady(), { once: true })
    return img
  }

  show(id: string, time: number, opts?: { loop?: boolean; restart?: boolean; onEnded?: () => void }): void {
    const loop = opts?.loop ?? true
    this.ended = opts?.onEnded ?? null
    if (!id) {
      if (this.current) {
        if (this.current.media instanceof HTMLVideoElement) this.current.media.pause()
        this.previous = this.current
        this.current = null
      }
      return
    }
    if (id === this.current?.id && !opts?.restart) {
      if (this.current.media instanceof HTMLVideoElement) this.current.media.loop = loop
      return
    }
    if (id === this.attemptedId && time - this.lookedAt < RETRY_MS && !opts?.restart) return
    this.attemptedId = id
    this.lookedAt = time
    const media = this.load(id, loop)
    if (!media) return
    if (this.current?.media instanceof HTMLVideoElement && this.current.media !== media) {
      this.current.media.pause()
    }
    this.previous = this.current && this.current.id !== id ? this.current : null
    this.current = { id, media, at: time }
  }

  private drawOne(ctx: CanvasRenderingContext2D, w: number, h: number, m: MediaElement, alpha: number, scale: number, ox: number, oy: number): void {
    const [nw, nh] = mediaSize(m)
    if (!nw || !nh || alpha <= 0) return
    const k = Math.max(w / nw, h / nh) * scale
    const dw = nw * k
    const dh = nh * k
    ctx.globalAlpha = alpha
    ctx.drawImage(m, (w - dw) / 2 + ox, (h - dh) / 2 + oy, dw, dh)
  }

  paint(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, opts?: { scale?: number; ox?: number; oy?: number; fadeMs?: number }): number {
    const scale = opts?.scale ?? 1
    const ox = opts?.ox ?? 0
    const oy = opts?.oy ?? 0
    const fadeMs = opts?.fadeMs ?? DEFAULT_FADE_MS
    const p = this.current ? (this.previous ? Math.min(1, (time - this.current.at) / fadeMs) : 1) : this.previous ? Math.max(0, 1 - (time - this.lookedAt) / fadeMs) : 0
    if (this.previous && p < 1) this.drawOne(ctx, w, h, this.previous.media, 1 - p, scale, ox, oy)
    if (this.current) this.drawOne(ctx, w, h, this.current.media, p, scale, ox, oy)
    ctx.globalAlpha = 1
    return this.current ? p : 0
  }

  dispose(): void {
    this.ended = null
    for (const v of this.videos.values()) {
      this.dropped.add(v)
      v.onended = null
      v.onloadeddata = null
      v.pause()
      v.removeAttribute('src')
      v.load()
    }
    this.videos.clear()
    this.current = null
    this.previous = null
  }
}
