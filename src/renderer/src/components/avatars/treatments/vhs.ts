import { BaseTreatment, type TreatmentFrame } from './BaseTreatment'
import { registerTreatmentDrawer } from './drawers'
import { channelInto } from './paint'

const BAND_STEP = 2
const STILL_BAND_AT = 0.6

class VhsTreatment extends BaseTreatment {
  protected draw(f: TreatmentFrame, drive: number): void {
    const { ctx, W, H } = f
    const t = f.time / 1000

    const smear = this.num('smear') * drive
    for (let i = 1; i <= Math.ceil(smear); i++) {
      ctx.globalAlpha = 0.18 * (1 - i / (smear + 1))
      ctx.drawImage(f.source, i, 0, W, H)
    }
    ctx.globalAlpha = 1

    const bandH = this.num('band') * H
    const y0 = f.still ? H * STILL_BAND_AT : ((t * this.num('roll')) % 1) * (H + bandH) - bandH
    const warp = this.num('warp') * drive
    this.slice(f, 0, Math.max(0, y0), 0)
    for (let y = Math.max(0, y0); y < Math.min(H, y0 + bandH); y += BAND_STEP) {
      const edge = 1 - Math.abs((y - y0) / bandH - 0.5) * 2
      this.slice(f, y, BAND_STEP, Math.sin(y * 0.3 + t * 20) * warp * edge)
    }
    this.slice(f, y0 + bandH, H - y0 - bandH, 0)
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.08
    ctx.fillStyle = f.signals.colors.ink
    ctx.fillRect(0, y0, W, bandH)

    const bleed = this.num('colourBleed') * drive
    if (bleed > 0) {
      const red = this.buffer(f, 0)
      channelInto(red, f.source, W, H, '#ff0000')
      const blue = this.buffer(f, 1)
      channelInto(blue, f.source, W, H, '#0000ff')
      ctx.globalAlpha = 0.45
      ctx.drawImage(red.canvas, -bleed, 0, W, H)
      ctx.drawImage(blue.canvas, bleed, 0, W, H)
    }
    ctx.globalCompositeOperation = 'source-over'

    const noise = f.still ? 0 : this.num('noise') * drive
    for (let i = 0; i < noise * 40; i++) {
      ctx.globalAlpha = Math.random() * 0.35
      ctx.fillRect(Math.random() * W, Math.random() * H, 4 + Math.random() * 36, 1)
    }
    ctx.globalAlpha = 1
  }
}

registerTreatmentDrawer('vhs', VhsTreatment)
