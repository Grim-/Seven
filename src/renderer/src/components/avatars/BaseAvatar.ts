import { avatarRendererInfo, avatarSizeOf, type Avatar, type AvatarRendererInfo } from '@shared/avatars'
import { NEUTRAL_MOOD, isMood, moodDef, nearestMood } from '@shared/moods'
import { isThemeColor, type SettingValue, type SettingValues } from '@shared/settingSpec'
import { Animated } from '../animated/Animated'
import type { AvatarSignals, SignalSource } from './signals'

export abstract class BaseAvatar extends Animated<SettingValues> {
  avatar: Avatar
  protected info: AvatarRendererInfo | null
  protected source: SignalSource
  protected signals!: AvatarSignals
  private moodKeys: string[] = []

  constructor(avatar: Avatar, source: SignalSource) {
    super({ accent: '', secondary: '', base: '' }, avatar.settings)
    this.avatar = avatar
    this.info = avatarRendererInfo(avatar.renderer)
    this.source = source
    this.noteKeys()
  }

  setAvatar(avatar: Avatar): void {
    this.avatar = avatar
    this.info = avatarRendererInfo(avatar.renderer)
    this.noteKeys()
    this.setSettings(avatar.settings)
  }

  protected override onMount(): void {
    this.source.changed = () => this.refresh()
    this.source.activityChanged = (from, to) => this.onActivity(from, to)
  }

  protected override onDispose(): void {
    this.source.changed = null
    this.source.activityChanged = null
  }

  protected override pixelRatio(): number {
    return window.devicePixelRatio || 1
  }

  protected override still(): boolean {
    return super.still() || Boolean(this.info?.stillAt.includes(avatarSizeOf(Math.min(this.width, this.height))))
  }

  protected onFrame(dt: number, time: number): void {
    this.signals = this.source.read(time, this.canvas, avatarSizeOf(Math.min(this.width, this.height)))
    this.draw(dt, time, this.signals)
  }

  protected onActivity(_from: string, _to: string): void {}

  protected abstract draw(dt: number, time: number, signals: AvatarSignals): void

  protected poseKey(s: AvatarSignals): string | null {
    if (s.mood.strength > 0.5 && s.mood.name !== NEUTRAL_MOOD) {
      const def = moodDef(s.mood.name)
      const key = def ? nearestMood(def.energy, def.warmth, [NEUTRAL_MOOD, ...this.moodKeys]) : null
      if (key && key !== NEUTRAL_MOOD) return key
    }
    return s.activity in this.avatar.poses ? s.activity : null
  }

  protected value(name: string, key: string | null): SettingValue | undefined {
    const posed = key ? this.avatar.poses[key]?.[name] : undefined
    return posed !== undefined ? posed : this.settings[name]
  }

  protected num(name: string, key: string | null): number {
    const v = this.value(name, key)
    return typeof v === 'number' ? v : 0
  }

  protected text(name: string, key: string | null): string {
    const v = this.value(name, key)
    return typeof v === 'string' ? v : ''
  }

  protected flag(name: string, key: string | null): boolean {
    return this.value(name, key) === true
  }

  protected frames(name: string, key: string | null): string[] {
    const v = this.value(name, key)
    return Array.isArray(v) && v.length ? v : ['']
  }

  protected color(name: string, key: string | null): string {
    const v = this.text(name, key)
    return isThemeColor(v) ? this.signals.colors[v as 'accent' | 'secondary'] : v || this.signals.colors.accent
  }

  private noteKeys(): void {
    this.moodKeys = Object.keys(this.avatar.poses).filter(isMood)
  }
}
