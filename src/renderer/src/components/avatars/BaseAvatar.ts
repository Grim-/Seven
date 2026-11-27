import { avatarRendererInfo, avatarSizeOf, type Avatar, type AvatarRendererInfo } from '@shared/avatars'
import { NEUTRAL_MOOD, isMood, isReactionPose, moodDef, nearestMood } from '@shared/moods'
import type { FrameEntry, SettingValue, SettingValues } from '@shared/settingSpec'
import { Animated } from '../animated/Animated'
import { MediaLayer } from './mediaLayer'
import { asFlag, asNumber, asText, posedValue, themedColor } from './posedValues'
import { TreatmentStack } from './treatments/TreatmentStack'
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
  private readonly stack = new TreatmentStack()
  private output: HTMLCanvasElement | null = null

  constructor(avatar: Avatar, source: SignalSource) {
    super({ accent: '', secondary: '', base: '' }, avatar.settings)
    this.avatar = avatar
    this.info = avatarRendererInfo(avatar.renderer)
    this.source = source
    this.noteKeys()
    this.stack.set(avatar.treatments ?? [])
  }

  setAvatar(avatar: Avatar): void {
    this.avatar = avatar
    this.info = avatarRendererInfo(avatar.renderer)
    this.noteKeys()
    this.stack.set(avatar.treatments ?? [])
    this.reschedule()
    this.setSettings(avatar.settings)
  }

  setOutput(canvas: HTMLCanvasElement | null): void {
    this.output = canvas
    this.reschedule()
    this.refresh()
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
    this.stack.dispose()
  }

  protected override pixelRatio(): number {
    return window.devicePixelRatio || 1
  }

  protected override still(): boolean {
    if (this.activeReaction && performance.now() < this.activeReaction.until) return false
    if (super.still()) return true
    const size = avatarSizeOf(Math.min(this.width, this.height))
    if (this.output && this.stack.animatesAt(size)) return false
    return Boolean(this.info?.stillAt.includes(size))
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
    if (this.output && this.canvas) this.stack.run(this.output, this.canvas, { width: this.width, height: this.height, ratio: this.pixelRatio(), dt, time, still: this.still(), signals: this.signals })
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
    return posedValue(this.settings, this.avatar.poses, name, key)
  }

  protected num(name: string, key: string | null): number {
    return asNumber(this.value(name, key))
  }

  protected text(name: string, key: string | null): string {
    return asText(this.value(name, key))
  }

  protected flag(name: string, key: string | null): boolean {
    return asFlag(this.value(name, key))
  }

  protected frames(name: string, key: string | null, fallbackEmpty = true): FrameEntry[] {
    const v = this.value(name, key)
    if (Array.isArray(v) && v.length) return v
    return fallbackEmpty ? [''] : []
  }

  protected color(name: string, key: string | null): string {
    return themedColor(this.text(name, key), this.signals.colors)
  }

  private noteKeys(): void {
    this.moodKeys = Object.keys(this.avatar.poses).filter(isMood)
  }
}
