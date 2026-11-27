import { BLEND_MODES, avatarSizeOf, avatarTreatmentInfo, sizeRank, stackBleed, type AvatarSize, type TreatmentEntry } from '@shared/avatars'
import { NEUTRAL_MOOD } from '@shared/moods'
import { asFlag, asText, asNumber, posedValue } from '../posedValues'
import type { AvatarSignals } from '../signals'
import type { BaseTreatment } from './BaseTreatment'
import { treatmentDrawer } from './drawers'
import { Buffers, reset } from './paint'
import './register'

export interface StackFrame {
  width: number
  height: number
  ratio: number
  dt: number
  time: number
  still: boolean
  signals: AvatarSignals
}

interface Layer {
  entry: TreatmentEntry
  drawer: BaseTreatment
}

function poseFor(entry: TreatmentEntry, s: AvatarSignals): string | null {
  const mood = s.mood.strength > 0.5 && s.mood.name !== NEUTRAL_MOOD ? s.mood.name : null
  return [s.reaction?.kind, mood, s.activity].find((k): k is string => Boolean(k && entry.poses[k])) ?? null
}

function shownAt(entry: TreatmentEntry, size: AvatarSize): boolean {
  return sizeRank(size) >= sizeRank(asText(entry.settings.from))
}

export class TreatmentStack {
  private layers: Layer[] = []
  private bleed = 0
  private readonly buffers = new Buffers()

  set(entries: TreatmentEntry[]): void {
    const old = new Map(this.layers.map((l) => [l.entry.key, l]))
    this.layers = entries.flatMap((entry) => {
      const kept = old.get(entry.key)
      if (kept && kept.entry.type === entry.type) {
        old.delete(entry.key)
        kept.entry = entry
        kept.drawer.setEntry(entry)
        return [kept]
      }
      const info = avatarTreatmentInfo(entry.type)
      const Maker = treatmentDrawer(entry.type)
      return info && Maker ? [{ entry, drawer: new Maker(entry, info) }] : []
    })
    for (const gone of old.values()) gone.drawer.dispose()
    this.bleed = stackBleed(entries)
  }

  animatesAt(size: AvatarSize): boolean {
    return this.layers.some((l) => shownAt(l.entry, size) && avatarTreatmentInfo(l.entry.type)?.animates)
  }

  dispose(): void {
    for (const l of this.layers) l.drawer.dispose()
    this.layers = []
    this.buffers.clear()
  }

  run(out: HTMLCanvasElement, source: HTMLCanvasElement, f: StackFrame): void {
    const { width: w, height: h, ratio } = f
    const bx = this.bleed * w
    const by = this.bleed * h
    const W = w + bx * 2
    const H = h + by * 2
    const pw = Math.max(1, Math.round(W * ratio))
    const ph = Math.max(1, Math.round(H * ratio))
    if (out.width !== pw || out.height !== ph) {
      out.width = pw
      out.height = ph
    }
    const size = avatarSizeOf(Math.min(w, h))
    let cur = this.buffers.get(0, W, H, ratio)
    cur.drawImage(source, bx, by, w, h)
    let spare = this.buffers.get(1, W, H, ratio)
    for (const layer of this.layers) {
      if (!shownAt(layer.entry, size)) continue
      const pose = poseFor(layer.entry, f.signals)
      const read = (name: string) => posedValue(layer.entry.settings, layer.entry.poses, name, pose)
      if (!asFlag(read('on'))) continue
      const mix = asNumber(read('mix'))
      if (mix <= 0) continue
      const fx = this.buffers.get(2, W, H, ratio)
      layer.drawer.render({ ctx: fx, source: cur.canvas, W, H, box: { x: bx, y: by, w, h }, ratio, dt: f.dt, time: f.time, still: f.still, signals: f.signals, pose })
      reset(fx)
      const op = (BLEND_MODES.find((b) => b.value === asText(read('blend'))) ?? BLEND_MODES[0]).op as GlobalCompositeOperation
      spare.clearRect(0, 0, W, H)
      spare.globalAlpha = op === 'source-over' ? 1 - mix : 1
      spare.drawImage(cur.canvas, 0, 0, W, H)
      spare.globalAlpha = mix
      spare.globalCompositeOperation = op
      spare.drawImage(fx.canvas, 0, 0, W, H)
      spare.globalAlpha = 1
      spare.globalCompositeOperation = 'source-over'
      const swap = cur
      cur = spare
      spare = swap
    }
    const ctx = out.getContext('2d')!
    reset(ctx)
    ctx.clearRect(0, 0, pw, ph)
    ctx.drawImage(cur.canvas, 0, 0)
  }
}
