export interface StartColors {
  ground: string
  ink: string
  dim: string
  accent: string
}

export const START_COLOR_KEYS: (keyof StartColors)[] = ['ground', 'ink', 'dim', 'accent']

const ARG = '--seven-start-colors='
const HEX6 = /^#[0-9a-f]{6}$/

export function cleanStartColors(value: unknown): StartColors | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const out = Object.fromEntries(START_COLOR_KEYS.map((k) => [k, typeof v[k] === 'string' && HEX6.test(v[k] as string) ? v[k] : null]))
  return START_COLOR_KEYS.every((k) => out[k]) ? (out as unknown as StartColors) : null
}

export function startColorsArg(colors: StartColors): string {
  return `${ARG}${START_COLOR_KEYS.map((k) => colors[k]).join(',')}`
}

export function startColorsFromArgs(argv: string[]): StartColors | null {
  const arg = argv.find((a) => a.startsWith(ARG))
  if (!arg) return null
  const parts = arg.slice(ARG.length).split(',')
  return cleanStartColors(Object.fromEntries(START_COLOR_KEYS.map((k, i) => [k, parts[i]])))
}
