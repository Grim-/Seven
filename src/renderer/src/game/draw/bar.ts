import type { Graphics } from 'pixi.js'

export function drawBar(g: Graphics, w: number, h: number, value: number, color: string, back: string, y = 0): Graphics {
  const v = Math.max(0, Math.min(1, value))
  g.rect(0, y, w, h).fill({ color: back, alpha: 0.85 })
  if (v > 0) g.rect(0, y, w * v, h).fill({ color })
  return g
}
