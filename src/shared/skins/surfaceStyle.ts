export interface SurfaceStyle {
  [key: string]: string | SurfaceStyle
}

export const SURFACE_STYLE_MAX = 200_000
const DEPTH = 6

function cssName(key: string): string {
  if (!/^[a-zA-Z]+$/.test(key) || !/[A-Z]/.test(key)) return key
  const name = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
  return name.startsWith('ms-') ? `-${name}` : name
}

export function cleanSurfaceStyle(value: unknown, depth = 0): SurfaceStyle | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > DEPTH) return undefined
  const out: SurfaceStyle = {}
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    const k = key.trim()
    if (!k) continue
    if (typeof v === 'string' || typeof v === 'number') out[cssName(k)] = String(v)
    else {
      const nested = cleanSurfaceStyle(v, depth + 1)
      if (nested && Object.keys(nested).length) out[k] = nested
    }
  }
  return Object.keys(out).length && JSON.stringify(out).length <= SURFACE_STYLE_MAX ? out : undefined
}

export function mapStyleValues(style: SurfaceStyle, map: (value: string) => string): SurfaceStyle {
  return Object.fromEntries(Object.entries(style).map(([k, v]) => [k, typeof v === 'string' ? map(v) : mapStyleValues(v, map)]))
}

export function isTopLevel(key: string): boolean {
  return key.startsWith('@keyframes')
}

export function styleCss(style: SurfaceStyle, pad = ''): string {
  return Object.entries(style)
    .map(([k, v]) => (typeof v === 'string' ? `${pad}${k}: ${v};` : `${pad}${k} {\n${styleCss(v, `${pad}  `)}\n${pad}}`))
    .join('\n')
}
