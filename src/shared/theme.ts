import { isAssetId } from './ids'
import { cleanBackdrop, type Backdrop } from './types'
import { cleanEffectSettings, isEffect, type EffectSettings } from './backgrounds'

export const SKY_MODES = ['off', 'clock', 'dawn', 'day', 'dusk', 'night'] as const
export type SkyMode = (typeof SKY_MODES)[number]
export type SkyPhase = Exclude<SkyMode, 'off' | 'clock'>

export type ThemeEffect = string

export const THEME_SOUNDS = ['reply', 'reminder', 'ask'] as const
export type ThemeSoundEvent = (typeof THEME_SOUNDS)[number]

export interface MoodLight {
  color: string
  strength: number
}

export interface Theme {
  id: string
  name: string
  description: string
  accent: string
  accentSoft: string
  secondary: string
  base: string
  sky: SkyMode
  light: MoodLight | null
  backdrop: Backdrop | null
  effect: ThemeEffect
  effectSettings: EffectSettings
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
  description: "Seven's own amber on black, with the data feed behind it.",
  accent: '#ffc919',
  accentSoft: '#e39d07',
  secondary: '#00e5ff',
  base: '#090a0d',
  sky: 'off',
  light: null,
  backdrop: null,
  effect: 'feed',
  effectSettings: {},
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

function hex(value: unknown, fallback: string): string {
  return isHex(value) ? value.toLowerCase() : fallback
}

function unit(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback
}

export function cleanLight(value: unknown): MoodLight | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<MoodLight>
  if (!isHex(v.color)) return null
  return { color: v.color.toLowerCase(), strength: unit(v.strength, 0.35) }
}

export function cleanTracks(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((x): x is string => isAssetId(x)))].slice(0, 50) : []
}

export function cleanTheme(value: unknown, base: Theme = SEVEN_THEME): Omit<Theme, 'id' | 'createdAt' | 'updatedAt' | 'builtin'> {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<Theme>
  const sounds = (v.sounds && typeof v.sounds === 'object' ? v.sounds : {}) as Partial<Theme['sounds']>
  const sound = (k: ThemeSoundEvent) => {
    const s = k in sounds ? sounds[k] : base.sounds[k]
    return isAssetId(s) ? s : null
  }
  return {
    name: typeof v.name === 'string' && v.name.trim() ? v.name.trim().slice(0, 60) : base.name,
    description: typeof v.description === 'string' ? v.description.trim().slice(0, 300) : base.description,
    accent: hex(v.accent, base.accent),
    accentSoft: hex(v.accentSoft, base.accentSoft),
    secondary: hex(v.secondary, base.secondary),
    base: hex(v.base, base.base),
    sky: SKY_MODES.includes(v.sky as SkyMode) ? (v.sky as SkyMode) : base.sky,
    light: 'light' in v ? cleanLight(v.light) : base.light,
    backdrop: 'backdrop' in v ? cleanBackdrop(v.backdrop) : base.backdrop,
    effect: isEffect(v.effect) ? v.effect : base.effect,
    effectSettings: 'effectSettings' in v ? cleanEffectSettings(v.effectSettings) : (base.effectSettings ?? {}),
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
