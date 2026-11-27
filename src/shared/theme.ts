import { isAssetId } from './ids'
import { cleanBackdrop, type Backdrop } from './types'
import { cleanEffectSettings, isEffect, type EffectSettings } from './backgrounds'
import { SEVEN_LOOK, cleanLook, type ThemeLook } from './themeLook'
import { cleanGradient, cleanStops, type Gradient, type GradientStop } from './gradient'

export const SKY_MODES = ['off', 'clock', 'dawn', 'day', 'dusk', 'night'] as const
export type SkyMode = (typeof SKY_MODES)[number]
export type SkyPhase = Exclude<SkyMode, 'off' | 'clock'>

export type ThemeEffect = string

export const THEME_SOUNDS = ['reply', 'reminder', 'ask'] as const
export type ThemeSoundEvent = (typeof THEME_SOUNDS)[number]

export interface MoodLight {
  stops: GradientStop[]
  strength: number
}


export interface Theme extends ThemeLook {
  id: string
  name: string
  description: string
  sky: SkyMode
  light: MoodLight | null
  backdrop: Backdrop | null
  gradient: Gradient | null
  effect: ThemeEffect
  effectSettings: EffectSettings
  chatFadeOpacity: number
  music: string[]
  volume: number
  sounds: Record<ThemeSoundEvent, string | null>
  builtin?: boolean
  createdBy?: string | null
  createdAt: number
  updatedAt: number
}

export interface Ambience {
  theme: string | null
  sky: SkyMode | null
  light: MoodLight | null
  music: string[] | null
  background: string | null
  until: number | null
}

export interface AmbienceCue {
  sessionId: string
  sound: string | null
  flash: string | null
  shake: boolean
  reaction?: string | null
}

export const DEFAULT_THEME_ID = 'seven'

export const SEVEN_THEME: Theme = {
  id: DEFAULT_THEME_ID,
  name: 'Seven',
  description: "Seven's own look: monospace, square and dark, amber on black, with the data feed behind it.",
  ...SEVEN_LOOK,
  sky: 'off',
  light: null,
  backdrop: null,
  gradient: null,
  effect: 'feed',
  effectSettings: {},
  chatFadeOpacity: 0.55,
  music: [],
  volume: 0.6,
  sounds: { reply: null, reminder: null, ask: null },
  builtin: true,
  createdAt: 0,
  updatedAt: 0
}

const HEX = /^#[0-9a-fA-F]{6}$/

export function isHex(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value)
}

function unit(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback
}

export function cleanLight(value: unknown): MoodLight | null {
  if (!value || typeof value !== 'object') return null
  const v = value as { stops?: unknown; strength?: unknown }
  const stops = cleanStops(v.stops)
  return stops.length ? { stops, strength: unit(v.strength, 0.35) } : null
}

export function cleanTracks(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((x): x is string => isAssetId(x)))].slice(0, 50) : []
}

export type ThemeDraft = Omit<Theme, 'id' | 'createdAt' | 'updatedAt' | 'builtin'>

export type ThemeInput = Partial<ThemeDraft> & { id?: string | null }

export function cleanTheme(value: unknown, base: Theme = SEVEN_THEME): ThemeDraft {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<Theme>
  const sounds = (v.sounds && typeof v.sounds === 'object' ? v.sounds : {}) as Partial<Theme['sounds']>
  const sound = (k: ThemeSoundEvent) => {
    const s = k in sounds ? sounds[k] : base.sounds[k]
    return isAssetId(s) ? s : null
  }
  return {
    ...cleanLook(v, base),
    name: typeof v.name === 'string' && v.name.trim() ? v.name.trim().slice(0, 60) : base.name,
    description: typeof v.description === 'string' ? v.description.trim().slice(0, 300) : base.description,
    sky: SKY_MODES.includes(v.sky as SkyMode) ? (v.sky as SkyMode) : base.sky,
    light: 'light' in v ? cleanLight(v.light) : base.light,
    backdrop: 'backdrop' in v ? cleanBackdrop(v.backdrop) : base.backdrop,
    gradient: 'gradient' in v ? cleanGradient(v.gradient) : base.gradient,
    effect: isEffect(v.effect) ? v.effect : base.effect,
    effectSettings: 'effectSettings' in v ? cleanEffectSettings(v.effectSettings) : (base.effectSettings ?? {}),
    chatFadeOpacity: unit(v.chatFadeOpacity, base.chatFadeOpacity ?? SEVEN_THEME.chatFadeOpacity),
    music: 'music' in v ? cleanTracks(v.music) : base.music,
    volume: unit(v.volume, base.volume),
    sounds: { reply: sound('reply'), reminder: sound('reminder'), ask: sound('ask') },
    createdBy: typeof v.createdBy === 'string' ? v.createdBy : (base.createdBy ?? null)
  }
}

export const NO_AMBIENCE: Ambience = { theme: null, sky: null, light: null, music: null, background: null, until: null }

export function cleanAmbience(value: unknown): Ambience {
  if (!value || typeof value !== 'object') return NO_AMBIENCE
  const v = value as Partial<Ambience>
  const until = typeof v.until === 'number' && Number.isFinite(v.until) ? v.until : null
  if (until !== null && until <= Date.now()) return NO_AMBIENCE
  return {
    theme: typeof v.theme === 'string' && v.theme ? v.theme : null,
    sky: SKY_MODES.includes(v.sky as SkyMode) ? (v.sky as SkyMode) : null,
    light: cleanLight(v.light),
    music: Array.isArray(v.music) ? cleanTracks(v.music) : null,
    background: isEffect(v.background) ? v.background : null,
    until
  }
}

export function skyPhase(mode: SkyMode, now = new Date()): SkyPhase | null {
  if (mode === 'off') return null
  if (mode !== 'clock') return mode
  const h = now.getHours() + now.getMinutes() / 60
  if (h >= 5 && h < 8) return 'dawn'
  if (h >= 8 && h < 17.5) return 'day'
  if (h >= 17.5 && h < 20.5) return 'dusk'
  return 'night'
}
