export const BACKGROUND_MODULE = 'backgrounds'

export interface BackgroundReaction {
  name: string
  description: string
}

export interface BackgroundSetting {
  name: string
  label: string
  type: 'range' | 'color'
  min?: number
  max?: number
  step?: number
  default: number | string
}

export interface BackgroundInfo {
  id: string
  name: string
  description: string
  reactions: BackgroundReaction[]
  settings: BackgroundSetting[]
}

export type EffectSettings = Record<string, number | string>

export const CORE_EFFECTS: { id: string; name: string }[] = [
  { id: 'none', name: 'None' },
  { id: 'feed', name: 'Data feed' }
]

export const BACKGROUNDS: BackgroundInfo[] = [
  {
    id: 'cyberdeck',
    name: 'Cyberdeck',
    description: 'Optic framing, corner readouts, a slow scanline and drifting data, in the theme colours.',
    reactions: [
      { name: 'warning', description: 'Goes red alert for a few seconds' },
      { name: 'glitch', description: 'A burst of scanline glitches' }
    ],
    settings: []
  },
  {
    id: 'neon-city',
    name: 'Neon cityscape',
    description: 'A skyline drifting under a rising and setting moon, with light trails along the horizon.',
    reactions: [
      { name: 'light_trail', description: 'A bright light trail races along the horizon' },
      { name: 'moonrise', description: 'The moon rises and the sky glows, then settles' }
    ],
    settings: [
      { name: 'moonRadius', label: 'Moon size', type: 'range', min: 20, max: 300, step: 1, default: 100 },
      { name: 'starCount', label: 'Stars', type: 'range', min: 0, max: 600, step: 10, default: 150 },
      { name: 'moonColor', label: 'Moon colour', type: 'color', default: '#1ccaed' },
      { name: 'speed', label: 'Speed', type: 'range', min: 0, max: 3, step: 0.1, default: 1 }
    ]
  },
  {
    id: 'blackwall',
    name: 'Blackwall',
    description: 'A wall of dark panels with red bleeding through it and slow breaches.',
    reactions: [
      { name: 'breach', description: 'Something breaks through the wall' },
      { name: 'face', description: 'A face shows through the wall for a moment' }
    ],
    settings: []
  }
]

export function backgroundInfo(id: string | null | undefined): BackgroundInfo | null {
  return BACKGROUNDS.find((b) => b.id === id) ?? null
}

export function isEffect(value: unknown): value is string {
  return typeof value === 'string' && (CORE_EFFECTS.some((e) => e.id === value) || BACKGROUNDS.some((b) => b.id === value))
}

export function effectName(id: string): string {
  return CORE_EFFECTS.find((e) => e.id === id)?.name ?? backgroundInfo(id)?.name ?? id
}

export function cleanEffectSettings(value: unknown): EffectSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: EffectSettings = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 20)) {
    if (!/^[A-Za-z][\w]{0,30}$/.test(k)) continue
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    else if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) out[k] = v.toLowerCase()
  }
  return out
}

export function effectSettingsFor(info: BackgroundInfo, saved: EffectSettings): Record<string, number | string> {
  const out: Record<string, number | string> = {}
  for (const s of info.settings) {
    const v = saved[s.name]
    out[s.name] = s.type === 'range' ? (typeof v === 'number' ? Math.min(s.max ?? v, Math.max(s.min ?? v, v)) : s.default) : typeof v === 'string' ? v : s.default
  }
  return out
}

export function reactionsText(): string {
  return BACKGROUNDS.filter((b) => b.reactions.length)
    .map((b) => `${b.id} (${b.reactions.map((r) => r.name).join(', ')})`)
    .join('; ')
}
