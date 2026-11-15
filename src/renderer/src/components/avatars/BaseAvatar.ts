import { avatarRendererInfo, avatarSizeOf, type Avatar, type AvatarRendererInfo } from '@shared/avatars'
import { NEUTRAL_MOOD, isMood, isReactionPose, moodDef, nearestMood } from '@shared/moods'
import { isThemeColor, type FrameEntry, type SettingValue, type SettingValues } from '@shared/settingSpec'
import { Animated } from '../animated/Animated'
import { MediaLayer } from './mediaLayer'
import type { AvatarSignals, SignalSource } from './signals'

const REACTION_MS = 1600

export abstract class BaseAvatar extends Animated<SettingValues> {
  avatar: Avatar
  protected info: AvatarRendererInfo | null
  protected source: SignalSource
  protected signals!: AvatarSignals
  protected ownsMedia = false
  protected readonly media = new MediaLayer(() => this.refresh())
  private moodKeys: string[] = []
  private activeReaction: { key: string; until: number; restart: boolean } | null = null

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
    this.source.reactionTriggered = (kind, durationMs, detail) => this.react(kind, { durationMs, ...(detail ?? {}) })
  }

  protected override onDispose(): void {
    this.source.changed = null
    this.source.activityChanged = null
    this.source.reactionTriggered = null
    this.media.dispose()
  }

  protected override pixelRatio(): number {
    return window.devicePixelRatio || 1
  }

  protected override still(): boolean {
    if (this.activeReaction && performance.now() < this.activeReaction.until) return false
    return super.still() || Boolean(this.info?.stillAt.includes(avatarSizeOf(Math.min(this.width, this.height))))
  }

  protected override onReaction(name: string, detail?: Record<string, unknown>): void {
    if (!name) return this.clearReaction()
    const durationMs = typeof detail?.durationMs === 'number' ? detail.durationMs : REACTION_MS
    this.activeReaction = { key: name, until: performance.now() + durationMs, restart: true }
    this.reschedule()
    this.refresh()
  }

  protected clearReaction(): void {
    if (!this.activeReaction) return
    this.activeReaction = null
    this.reschedule()
    this.refresh()
  }

  protected onFrame(dt: number, time: number): void {
    this.signals = this.source.read(time, this.canvas, avatarSizeOf(Math.min(this.width, this.height)))
    if (this.activeReaction && time >= this.activeReaction.until) {
      this.activeReaction = null
      this.reschedule()
    }
    this.draw(dt, time, this.signals)
  }

  protected paintMediaClip(clip: string, time: number, key: string | null, opts?: { clear?: boolean; scale?: number; ox?: number; oy?: number }): boolean {
    if (!clip) {
      if (this.media.activeId) this.media.show('', time)
      return false
    }
    const isOneShot = Boolean((this.activeReaction && key === this.activeReaction.key) || (key && isReactionPose(key)))
    const restart = Boolean(this.activeReaction?.restart && key === this.activeReaction.key)
    if (this.activeReaction && restart) this.activeReaction.restart = false
    this.media.show(clip, time, { loop: !isOneShot, restart, onEnded: () => this.clearReaction() })
    if (opts?.clear !== false) this.ctx.clearRect(0, 0, this.width, this.height)
    this.media.paint(this.ctx, this.width, this.height, time, opts)
    return true
  }

  protected poseClip(key: string | null, sequenceSetting: string): string {
    if (key && this.hasOwn('picture', key)) return this.ownText('picture', key)
    if (key && this.hasOwn(sequenceSetting, key)) return ''
    return this.text('picture', null)
  }

  protected onActivity(_from: string, _to: string): void {}

  protected abstract draw(dt: number, time: number, signals: AvatarSignals): void

  protected poseKey(s: AvatarSignals): string | null {
    if (this.activeReaction && this.activeReaction.key in this.avatar.poses) return this.activeReaction.key
    if (s.reaction && s.reaction.kind in this.avatar.poses) return s.reaction.kind
    if (s.mood.strength > 0.5 && s.mood.name !== NEUTRAL_MOOD) {
      const def = moodDef(s.mood.name)
      const key = def ? nearestMood(def.energy, def.warmth, [NEUTRAL_MOOD, ...this.moodKeys]) : null
      if (key && key !== NEUTRAL_MOOD) return key
    }
    return s.activity in this.avatar.poses ? s.activity : null
  }

  protected hasOwn(name: string, key: string | null): boolean {
    return Boolean(key && this.avatar.poses[key]?.[name] !== undefined)
  }

  protected ownText(name: string, key: string | null): string {
    const v = key ? this.avatar.poses[key]?.[name] : this.settings[name]
    return typeof v === 'string' ? v : ''
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

  protected frames(name: string, key: string | null, fallbackEmpty = true): FrameEntry[] {
    const v = this.value(name, key)
    if (Array.isArray(v) && v.length) return v
    return fallbackEmpty ? [''] : []
  }

  protected color(name: string, key: string | null): string {
    const v = this.text(name, key)
    return isThemeColor(v) ? this.signals.colors[v as 'accent' | 'secondary'] : v || this.signals.colors.accent
  }

  private noteKeys(): void {
    this.moodKeys = Object.keys(this.avatar.poses).filter(isMood)
  }
}
