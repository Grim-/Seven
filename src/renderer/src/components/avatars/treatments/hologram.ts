import { BaseTreatment, type TreatmentFrame } from './BaseTreatment'
import { registerTreatmentDrawer } from './drawers'
import { hash, tintInto } from './paint'

const DROPOUT_BANDS = 3

class HologramTreatment extends BaseTreatment {
  protected draw(f: TreatmentFrame, drive: number): void {
    const { ctx, W, H, box } = f
    const t = f.time / 1000
    const tint = this.color('tint', f.signals)
    const flicker = f.still ? 0 : this.num('flicker') * drive * 0.4 * hash(Math.floor(t * 24))
    const shown = 1 - flicker

    const cone = this.num('cone')
    if (cone > 0) {
      const g = ctx.createLinearGradient(0, H, 0, box.y)
      g.addColorStop(0, tint)
      g.addColorStop(1, 'transparent')
      ctx.globalAlpha = cone * 0.4 * shown
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(W / 2 - box.w * 0.1, H)
      ctx.lineTo(W / 2 + box.w * 0.1, H)
      ctx.lineTo(box.x + box.w, box.y)
      ctx.lineTo(box.x, box.y)
      ctx.closePath()
      ctx.fill()
    }

    const fringe = this.num('fringe') * drive
    if (fringe > 0) {
      const a = this.buffer(f, 0)
      tintInto(a, f.source, W, H, tint)
      const b = this.buffer(f, 1)
      tintInto(b, f.source, W, H, f.signals.colors.accent)
      ctx.globalAlpha = 0.35 * shown
      ctx.drawImage(a.canvas, -fringe, 0, W, H)
      ctx.drawImage(b.canvas, fringe, 0, W, H)
    }

    const gap = Math.max(2, this.num('lines'))
    const jitter = f.still ? 0 : this.num('jitter') * drive
    const step = Math.floor(t * 12)
    ctx.globalAlpha = shown
    for (let y = 0; y < H; y += gap) this.slice(f, y, gap, jitter * Math.sin(y * 0.09 + t * 3.1) * (0.5 + 0.5 * hash(step + y)))

    const amount = this.num('tintAmount')
    if (amount > 0) {
      ctx.globalCompositeOperation = 'source-atop'
      ctx.globalAlpha = amount
      ctx.fillStyle = tint
      ctx.fillRect(0, 0, W, H)
    }

    ctx.globalCompositeOperation = 'destination-out'
    const dark = this.num('lineDark')
    if (dark > 0) {
      ctx.globalAlpha = dark
      for (let y = 0; y < H; y += gap) ctx.fillRect(0, y, W, Math.max(1, gap / 2))
    }
    const dropout = f.still ? 0 : this.num('dropout') * drive
    for (let i = 0; i < DROPOUT_BANDS; i++) {
      const seed = Math.floor(t * 2) * 31 + i * 17
      if (hash(seed) > dropout * 0.6) continue
      ctx.globalAlpha = 0.5 + 0.4 * hash(seed + 3)
      ctx.fillRect(0, hash(seed + 1) * H, W, 2 + hash(seed + 2) * H * 0.08)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
}

registerTreatmentDrawer('hologram', HologramTreatment)
