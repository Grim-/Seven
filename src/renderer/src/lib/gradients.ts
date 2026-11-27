import type { GradientStop } from '@shared/gradient'

export function linearFill(colors: string[], angle = '135deg'): string | undefined {
  if (!colors.length) return undefined
  return colors.length === 1 ? colors[0] : `linear-gradient(${angle}, ${colors.join(', ')})`
}

function stopList(stops: GradientStop[]): string {
  const sorted = [...stops].sort((a, b) => a.at - b.at)
  return (sorted.length === 1 ? [sorted[0], { ...sorted[0], at: 100 }] : sorted).map((s) => `${s.color} ${s.at}%`).join(', ')
}

export function stopsFill(stops: GradientStop[], angle: number): string | undefined {
  return stops.length ? `linear-gradient(${angle}deg, ${stopList(stops)})` : undefined
}

export function lightFill(stops: GradientStop[]): string | undefined {
  return stops.length ? `radial-gradient(ellipse 120% 90% at 50% 100%, ${stopList(stops)})` : undefined
}

export function splitColour(colour: string): { hex: string; alpha: number } {
  return { hex: colour.slice(0, 7), alpha: colour.length === 9 ? parseInt(colour.slice(7), 16) / 255 : 1 }
}

export function joinColour(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
  return a >= 255 ? hex : `${hex}${a.toString(16).padStart(2, '0')}`
}

function channels(colour: string): number[] {
  const { hex, alpha } = splitColour(colour)
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(alpha)
}

export function colourAt(stops: GradientStop[], at: number): string {
  const sorted = [...stops].sort((a, b) => a.at - b.at)
  const after = sorted.findIndex((s) => s.at >= at)
  if (after <= 0) return (after === 0 ? sorted[0] : sorted[sorted.length - 1]).color
  const a = sorted[after - 1]
  const b = sorted[after]
  const t = b.at === a.at ? 0 : (at - a.at) / (b.at - a.at)
  const [ca, cb] = [channels(a.color), channels(b.color)]
  const mixed = ca.map((v, i) => v + (cb[i] - v) * t)
  const hex = `#${mixed.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
  return joinColour(hex, mixed[3])
}
