import type { AvatarSize } from '@shared/avatars'
import { NEUTRAL_MOOD, moodDef, type Activity, type MoodName } from '@shared/moods'
import type { AnimatedColors } from '../animated/Animated'
import { useThemes } from '../../store/themes'

export interface AvatarMood {
  name: MoodName
  energy: number
  warmth: number
  strength: number
}

export interface AvatarReactionSignal {
  kind: string
  at: number
  until: number
  detail?: Record<string, unknown>
}

export interface AvatarToolSignal {
  name: string
  label: string
}

export interface AvatarSignals {
  activity: Activity
  since: number
  rate: number
  mood: AvatarMood
  reaction: AvatarReactionSignal | null
  tool: AvatarToolSignal | null
  gaze: { x: number; y: number } | null
  colors: AnimatedColors
  size: AvatarSize
  voice: number
}

const BLEND_MS = 400
const RATE_CHARS = 120

const pointer = { x: 0, y: 0, known: false }
let tracking = false

function trackPointer(): void {
  if (tracking) return
  tracking = true
  window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX
    pointer.y = e.clientY
    pointer.known = true
  })
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v))
const smooth = (p: number) => p * p * (3 - 2 * p)

interface Blend {
  from: { energy: number; warmth: number; strength: number; name: MoodName }
  to: { energy: number; warmth: number; strength: number; name: MoodName }
  at: number
}

export class SignalSource {
  changed: (() => void) | null = null
  activityChanged: ((from: Activity, to: Activity) => void) | null = null
  reactionTriggered: ((kind: string, durationMs: number, detail?: Record<string, unknown>) => void) | null = null
  private activity: Activity = 'idle'
  private activityAt = performance.now()
  private blend: Blend = { from: { energy: 0, warmth: 0, strength: 0, name: NEUTRAL_MOOD }, to: { energy: 0, warmth: 0, strength: 0, name: NEUTRAL_MOOD }, at: 0 }
  private reaction: AvatarReactionSignal | null = null
  private tool: AvatarToolSignal | null = null
  private spoken = 0
  private spokenAt = 0
  private rate = 0
  private forcedRate: number | null = null

  constructor() {
    trackPointer()
  }

  setMood(name: MoodName | null, dials?: { energy: number; warmth: number }): void {
    const target = name ?? NEUTRAL_MOOD
    const def = moodDef(target)
    const to = { energy: dials?.energy ?? def?.energy ?? 0, warmth: dials?.warmth ?? def?.warmth ?? 0, strength: name || dials ? 1 : 0, name: target }
    const was = this.blend.to
    if (was.name === to.name && was.energy === to.energy && was.warmth === to.warmth && was.strength === to.strength) return
    const now = performance.now()
    this.blend = { from: this.moodAt(now), to, at: now }
    this.changed?.()
  }

  setRate(rate: number | null): void {
    this.forcedRate = rate
  }

  setActivity(activity: Activity): void {
    if (activity === this.activity) return
    const from = this.activity
    this.activity = activity
    this.activityAt = performance.now()
    this.activityChanged?.(from, activity)
    this.changed?.()
  }

  triggerReaction(kind: string, durationMs = 1600, detail?: Record<string, unknown>): void {
    const now = performance.now()
    this.reaction = kind ? { kind, at: now, until: now + durationMs, detail } : null
    if (kind) this.reactionTriggered?.(kind, durationMs, detail)
    this.changed?.()
  }

  setTool(tool: AvatarToolSignal | null): void {
    if (this.tool?.name === tool?.name && this.tool?.label === tool?.label) return
    this.tool = tool
    this.changed?.()
  }

  noteSpoken(length: number): void {
    const now = performance.now()
    const added = length - this.spoken
    if (added > 0 && this.spokenAt) {
      const perSecond = (added / Math.max(16, now - this.spokenAt)) * 1000
      this.rate = this.rate * 0.7 + Math.min(1, perSecond / RATE_CHARS) * 0.3
    }
    this.spoken = length
    this.spokenAt = now
  }

  read(time: number, el: HTMLElement | null, size: AvatarSize): AvatarSignals {
    const quiet = this.spokenAt ? Math.exp(-Math.max(0, time - this.spokenAt - 250) / 600) : 0
    if (this.reaction && time >= this.reaction.until) this.reaction = null
    return {
      activity: this.activity,
      since: (time - this.activityAt) / 1000,
      rate: this.forcedRate ?? this.rate * quiet,
      mood: this.moodAt(time),
      reaction: this.reaction,
      tool: this.tool,
      gaze: this.gazeFrom(el),
      colors: useThemes.getState().palette,
      size,
      voice: 0
    }
  }

  private moodAt(time: number): AvatarMood {
    const { from, to, at } = this.blend
    const p = at ? smooth(Math.min(1, Math.max(0, (time - at) / BLEND_MS))) : 1
    return { name: p >= 0.5 ? to.name : from.name, energy: from.energy + (to.energy - from.energy) * p, warmth: from.warmth + (to.warmth - from.warmth) * p, strength: from.strength + (to.strength - from.strength) * p }
  }

  private gazeFrom(el: HTMLElement | null): { x: number; y: number } | null {
    if (!el || !pointer.known || !document.hasFocus()) return null
    const r = el.getBoundingClientRect()
    const reach = Math.max(window.innerWidth, window.innerHeight) / 2
    return { x: clamp((pointer.x - (r.left + r.width / 2)) / reach), y: clamp((pointer.y - (r.top + r.height / 2)) / reach) }
  }
}
