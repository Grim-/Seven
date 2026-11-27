import { BaseTreatment, type TreatmentFrame } from './BaseTreatment'
import { registerTreatmentDrawer } from './drawers'
import { channelInto } from './paint'

const CHANNELS = ['#ff0000', '#00ff00', '#0000ff']

class ChromaticTreatment extends BaseTreatment {
  protected draw(f: TreatmentFrame, drive: number): void {
    const distance = this.num('distance') * drive
    if (distance <= 0) return this.whole(f)
    const wobble = f.still ? 0 : Math.sin((f.time / 1000) * this.num('drift') * Math.PI * 2) * 0.6
    const angle = (this.num('angle') * Math.PI) / 180 + wobble
    const dx = Math.cos(angle) * distance
    const dy = Math.sin(angle) * distance
    f.ctx.globalCompositeOperation = 'lighter'
    CHANNELS.forEach((colour, i) => {
      const ch = this.buffer(f, i)
      channelInto(ch, f.source, f.W, f.H, colour)
      f.ctx.drawImage(ch.canvas, dx * (i - 1), dy * (i - 1), f.W, f.H)
    })
    f.ctx.globalCompositeOperation = 'source-over'
  }
}

registerTreatmentDrawer('chromatic', ChromaticTreatment)
