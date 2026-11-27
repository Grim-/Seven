import { ROLE_COLOURS, ROLE_FONTS } from './roles'

export type WidgetLook = Record<string, string>

const COLOUR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/
const FONT = /^[\p{L}\p{N}\s'",._-]{1,240}$/u
const TRACKING = /^(normal|-?\d*\.?\d+(em|px|rem))$/
const CASES = new Set(['uppercase', 'lowercase', 'capitalize', 'none'])
const VARIANTS = new Set(['normal', 'small-caps', 'all-small-caps', 'petite-caps', 'all-petite-caps', 'unicase', 'titling-caps'])

const RULES: [string, (v: string) => boolean][] = [
  ...ROLE_COLOURS.map((r) => [r, (v: string) => COLOUR.test(v)] as [string, (v: string) => boolean]),
  ...ROLE_FONTS.map((f) => [`font-${f}`, (v: string) => FONT.test(v)] as [string, (v: string) => boolean]),
  ['label-case', (v) => CASES.has(v)],
  ['label-tracking', (v) => TRACKING.test(v)],
  ['label-variant', (v) => VARIANTS.has(v)]
]

export function cleanWidgetLook(value: unknown): WidgetLook | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const out = Object.fromEntries(RULES.flatMap(([k, ok]) => (typeof v[k] === 'string' && ok(v[k] as string) ? [[k, v[k] as string]] : [])))
  return Object.keys(out).length ? out : null
}

export function widgetLookKey(look: WidgetLook | null): string {
  const clean = cleanWidgetLook(look)
  return clean ? JSON.stringify(clean) : ''
}

export function widgetLookCss(look: WidgetLook | null): string {
  const clean = cleanWidgetLook(look)
  return clean ? `:root{${Object.entries(clean).map(([k, v]) => `--${k}:${v}`).join(';')}}` : ''
}
