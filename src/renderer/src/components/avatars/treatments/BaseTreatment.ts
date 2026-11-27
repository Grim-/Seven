import type { AvatarTreatmentInfo, TreatmentEntry } from '@shared/avatars'
import type { SettingValue } from '@shared/settingSpec'
import { asFlag, asNumber, asText, posedValue, themedColor } from '../posedValues'
import type { AvatarSignals } from '../signals'
import { Buffers } from './paint'

export interface TreatmentFrame {
  ctx: CanvasRenderingContext2D
  source: HTMLCanvasElement
  W: number
  H: number
  box: { x: number; y: number; w: number; h: number }
  ratio: number
  dt: number
  time: number
  still: boolean
  signals: AvatarSignals
  pose: string | null
}

export abstract class BaseTreatment {
  protected entry: TreatmentEntry
  protected readonly info: AvatarTreatmentInfo
  protected readonly buffers = new Buffers()
  protected pose: string | null = null

  constructor(entry: TreatmentEntry, info: AvatarTreatmentInfo) {
    this.entry = entry
    this.info = info
  }

  setEntry(entry: TreatmentEntry): void {
    this.entry = entry
  }

  dispose(): void {
    this.buffers.clear()
  }

  render(f: TreatmentFrame): void {
    this.pose = f.pose
    this.draw(f, this.drive(f.signals))
  }

  protected abstract draw(f: TreatmentFrame, drive: number): void

  protected value(name: string): SettingValue | undefined {
    return posedValue(this.entry.settings, this.entry.poses, name, this.pose)
  }

  protected num(name: string): number {
    return asNumber(this.value(name))
  }

  protected text(name: string): string {
    return asText(this.value(name))
  }

  protected flag(name: string): boolean {
    return asFlag(this.value(name))
  }

  protected color(name: string, s: AvatarSignals): string {
    return themedColor(this.text(name), s.colors)
  }

  protected drive(s: AvatarSignals): number {
    const excited = Math.max(0, s.mood.energy * s.mood.strength) + (s.reaction ? 1 : 0)
    return 1 + this.num('reacts') * excited
  }

  protected pulse(f: TreatmentFrame, speed: number, depth: number): number {
    const wave = f.still || !speed ? 0.5 : 0.5 - 0.5 * Math.cos((f.time / 1000) * speed * Math.PI * 2)
    return 1 - depth * wave
  }

  protected whole(f: TreatmentFrame, alpha = 1): void {
    f.ctx.globalAlpha = alpha
    f.ctx.drawImage(f.source, 0, 0, f.W, f.H)
    f.ctx.globalAlpha = 1
  }

  protected slice(f: TreatmentFrame, y: number, h: number, dx: number, from: HTMLCanvasElement = f.source): void {
    if (h <= 0) return
    const r = f.ratio
    f.ctx.drawImage(from, 0, y * r, f.W * r, h * r, dx, y, f.W, h)
  }

  protected buffer(f: TreatmentFrame, index: number, clear = true): CanvasRenderingContext2D {
    return this.buffers.get(index, f.W, f.H, f.ratio, clear)
  }
}
