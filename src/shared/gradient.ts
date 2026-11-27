export interface GradientStop {
  color: string
  at: number
}

export interface Gradient {
  stops: GradientStop[]
  angle: number
}

export const MAX_STOPS = 8
export const DEFAULT_ANGLE = 135

const COLOUR = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/

function within(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function cleanStops(value: unknown): GradientStop[] {
  if (!Array.isArray(value)) return []
  return value
    .flatMap((s): GradientStop[] => {
      const v = (s && typeof s === 'object' ? s : {}) as Partial<GradientStop>
      return typeof v.color === 'string' && COLOUR.test(v.color) && typeof v.at === 'number' && Number.isFinite(v.at) ? [{ color: v.color.toLowerCase(), at: within(Math.round(v.at), 0, 100) }] : []
    })
    .slice(0, MAX_STOPS)
}

export function cleanGradient(value: unknown): Gradient | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<Gradient>
  const stops = cleanStops(v.stops)
  if (!stops.length) return null
  const angle = typeof v.angle === 'number' && Number.isFinite(v.angle) ? ((Math.round(v.angle) % 360) + 360) % 360 : DEFAULT_ANGLE
  return { stops, angle }
}

export function evenStops(colors: string[]): GradientStop[] {
  const last = Math.max(1, colors.length - 1)
  return colors.map((color, i) => ({ color, at: Math.round((i / last) * 100) }))
}

export function glowStops(colors: string[]): GradientStop[] {
  if (!colors.length) return []
  const last = Math.max(1, colors.length - 1)
  const fade = `${colors[colors.length - 1].slice(0, 7)}00`
  return [...colors.map((color, i) => ({ color, at: Math.round((i / last) * 45) })), { color: fade, at: 70 }]
}
