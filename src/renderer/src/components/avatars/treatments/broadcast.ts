import { BaseTreatment, type TreatmentFrame } from './BaseTreatment'
import { registerTreatmentDrawer } from './drawers'

const FIELD_LINES = 24
const HELD = 0
const LAST = 1

interface Band {
  y: number
  h: number
  dx: number
  until: number
}

class BroadcastTreatment extends BaseTreatment {
  private holdUntil = 0
  private band: Band | null = null

  protected draw(f: TreatmentFrame, drive: number): void {
    const { ctx, W, H } = f
    const t = f.time

    if (this.flag('field')) this.field(f)

    if (!f.still && t >= this.holdUntil && Math.random() < this.num('stutter') * drive * f.dt) this.holdUntil = t + this.num('hold')
    const held = this.buffer(f, HELD, false)
    if (f.still || t >= this.holdUntil) {
      held.clearRect(0, 0, W, H)
      held.drawImage(f.source, 0, 0, W, H)
    }
    const image = held.canvas

    if (!f.still && (!this.band || t >= this.band.until) && Math.random() < this.num('bands') * drive * f.dt) {
      this.band = { y: Math.random() * H, h: H * (0.04 + Math.random() * 0.12), dx: (Math.random() * 2 - 1) * this.num('jump') * drive, until: t + 80 + Math.random() * 140 }
    }
    const band = !f.still && this.band && t < this.band.until ? this.band : null
    if (band) {
      this.slice(f, 0, band.y, 0, image)
      this.slice(f, band.y, band.h, band.dx, image)
      this.slice(f, band.y + band.h, H - band.y - band.h, 0, image)
    } else {
      ctx.drawImage(image, 0, 0, W, H)
    }

    const last = this.buffer(f, LAST, false)
    if (this.flag('interlace') && !f.still) {
      ctx.globalAlpha = 0.45
      for (let y = 1; y < H; y += 2) this.slice(f, y, 1, 0, last.canvas)
      ctx.globalAlpha = 1
    }
    last.clearRect(0, 0, W, H)
    last.drawImage(image, 0, 0, W, H)
  }

  private field(f: TreatmentFrame): void {
    const { ctx, W, H } = f
    const turn = f.still ? 0 : (f.time / 1000) * this.num('fieldSpeed')
    const reach = Math.hypot(W, H)
    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.rotate(turn)
    ctx.strokeStyle = this.color('fieldColor', f.signals)
    ctx.globalAlpha = 0.3
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i < FIELD_LINES; i++) {
      const a = (i / FIELD_LINES) * Math.PI * 2
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(a) * reach, Math.sin(a) * reach)
    }
    ctx.stroke()
    ctx.restore()
  }
}

registerTreatmentDrawer('broadcast', BroadcastTreatment)
