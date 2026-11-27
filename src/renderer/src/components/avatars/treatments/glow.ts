import { moodColor } from '../moodColor'
import { BaseTreatment, type TreatmentFrame } from './BaseTreatment'
import { registerTreatmentDrawer } from './drawers'
import { tintInto } from './paint'

class GlowTreatment extends BaseTreatment {
  protected draw(f: TreatmentFrame, drive: number): void {
    const { ctx, W, H } = f
    const colour = this.flag('mood') ? moodColor(f.signals) : this.color('color', f.signals)
    const spread = this.num('spread') * Math.min(f.box.w, f.box.h)
    const near = spread * (0.2 + 0.4 * (1 - this.num('softness')))
    const pulse = this.pulse(f, this.num('pulse') * (0.7 + 0.3 * drive), this.num('depth'))
    const strength = this.num('strength') * drive * pulse
    const tint = this.buffer(f, 0)
    tintInto(tint, f.source, W, H, colour)
    ctx.globalCompositeOperation = 'lighter'
    for (const pass of [
      { blur: spread, alpha: 0.6 },
      { blur: spread * 0.55, alpha: 0.45 },
      { blur: near, alpha: 0.5 }
    ]) {
      ctx.filter = `blur(${pass.blur * f.ratio}px)`
      ctx.globalAlpha = Math.min(1, pass.alpha * strength)
      ctx.drawImage(tint.canvas, 0, 0, W, H)
    }
    ctx.filter = 'none'
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    this.whole(f)
  }
}

registerTreatmentDrawer('glow', GlowTreatment)
