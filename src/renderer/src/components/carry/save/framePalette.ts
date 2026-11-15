import { cssHex } from '../../../lib/cssColors'

export interface FramePalette {
  accent: string
  secondary: string
  base: string
  mono: string
  sans: string
}

export function readFramePalette(): FramePalette {
  const style = getComputedStyle(document.documentElement)
  return {
    accent: cssHex(style, '--color-accent', '#ffc919'),
    secondary: cssHex(style, '--color-teal', '#00e5ff'),
    base: cssHex(style, '--color-bg', '#090a0d'),
    mono: style.getPropertyValue('--font-mono').trim() || 'monospace',
    sans: style.getPropertyValue('--font-sans').trim() || 'sans-serif'
  }
}
