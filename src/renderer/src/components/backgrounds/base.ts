import { Animated, type AnimatedColors } from '../animated/Animated'

export type BackgroundColors = AnimatedColors

export type BackgroundSettings = Record<string, number | string>

export function rgbOf(hex: string): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

export abstract class BaseBackground extends Animated<BackgroundSettings> {
  protected override opaque = true

  num(name: string, fallback: number): number {
    const v = this.settings[name]
    return typeof v === 'number' ? v : fallback
  }

  str(name: string, fallback: string): string {
    const v = this.settings[name]
    return typeof v === 'string' ? v : fallback
  }
}
