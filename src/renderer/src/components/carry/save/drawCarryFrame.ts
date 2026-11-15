import { rgba } from '../../../lib/cssColors'
import type { FramePalette } from './framePalette'

export interface FrameInfo {
  label: string
  title: string
  also: number
  locked: boolean
  at: number
}

export interface FrameLayout {
  width: number
  height: number
  unit: number
  x: number
  y: number
}

const MIN_UNIT = 3

export function frameLayout(w: number, h: number): FrameLayout {
  const unit = Math.max(MIN_UNIT, Math.min(w, h) / 100)
  return { width: Math.round(w + unit * 10), height: Math.round(h + unit * 24), unit, x: Math.round(unit * 5), y: Math.round(unit * 7) }
}

function chamfer(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cuts: { tl?: number; tr?: number; br?: number; bl?: number }): void {
  const { tl = 0, tr = 0, br = 0, bl = 0 } = cuts
  ctx.beginPath()
  ctx.moveTo(x + tl, y)
  ctx.lineTo(x + w - tr, y)
  ctx.lineTo(x + w, y + tr)
  ctx.lineTo(x + w, y + h - br)
  ctx.lineTo(x + w - br, y + h)
  ctx.lineTo(x + bl, y + h)
  ctx.lineTo(x, y + h - bl)
  ctx.lineTo(x, y + tl)
  ctx.closePath()
}

function spacedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  const chars = [...text]
  return chars.reduce((w, c) => w + ctx.measureText(c).width, 0) + spacing * Math.max(0, chars.length - 1)
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, fromRight = false): number {
  const width = spacedWidth(ctx, text, spacing)
  let at = fromRight ? x - width : x
  for (const c of text) {
    ctx.fillText(c, at, y)
    at += ctx.measureText(c).width + spacing
  }
  return width
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

function seeded(text: string): () => number {
  let h = 2166136261
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

function backdrop(ctx: CanvasRenderingContext2D, W: number, H: number, u: number, p: FramePalette): void {
  ctx.fillStyle = p.base
  ctx.fillRect(0, 0, W, H)
  const reach = Math.max(W, H) * 0.75
  const warm = ctx.createRadialGradient(0, 0, 0, 0, 0, reach)
  warm.addColorStop(0, rgba(p.accent, 0.12))
  warm.addColorStop(1, rgba(p.accent, 0))
  ctx.fillStyle = warm
  ctx.fillRect(0, 0, W, H)
  const cool = ctx.createRadialGradient(W, H, 0, W, H, reach)
  cool.addColorStop(0, rgba(p.secondary, 0.1))
  cool.addColorStop(1, rgba(p.secondary, 0))
  ctx.fillStyle = cool
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = rgba(p.secondary, 0.05)
  const line = Math.max(1, u * 0.1)
  for (let x = 0; x < W; x += u * 4) ctx.fillRect(x, 0, line, H)
  for (let y = 0; y < H; y += u * 4) ctx.fillRect(0, y, W, line)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'
  for (let y = 0; y < H; y += Math.max(2, u * 0.6)) ctx.fillRect(0, y, W, Math.max(1, u * 0.2))
}

function card(ctx: CanvasRenderingContext2D, W: number, H: number, u: number, p: FramePalette): void {
  const inset = u * 1.5
  const cut = u * 4
  ctx.save()
  chamfer(ctx, inset, inset, W - inset * 2, H - inset * 2, { tl: cut, br: cut })
  ctx.strokeStyle = rgba(p.accent, 0.6)
  ctx.lineWidth = Math.max(1, u * 0.25)
  ctx.shadowColor = rgba(p.accent, 0.7)
  ctx.shadowBlur = u * 2
  ctx.stroke()
  ctx.restore()
  ctx.fillStyle = p.accent
  ctx.fillRect(inset, inset + cut, u * 0.8, H - inset * 2 - cut * 2)
  ctx.fillStyle = rgba(p.accent, 0.4)
  const tick = Math.max(1, u * 0.15)
  for (let y = inset + cut + u * 2, i = 0; y < H - inset - cut - u * 2; y += u * 2, i++) {
    const len = i % 5 === 0 ? u * 1.6 : u * 0.8
    ctx.fillRect(W - inset - u * 0.3 - len, y, len, tick)
  }
}

function brackets(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, u: number, color: string): void {
  const o = u * 1.1
  const len = u * 4
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1, u * 0.3)
  const corner = (cx: number, cy: number, dx: number, dy: number) => {
    ctx.beginPath()
    ctx.moveTo(cx + dx * len, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + dy * len)
    ctx.stroke()
  }
  corner(x - o, y - o, 1, 1)
  corner(x + w + o, y - o, -1, 1)
  corner(x - o, y + h + o, 1, -1)
  corner(x + w + o, y + h + o, -1, -1)
}

function header(ctx: CanvasRenderingContext2D, W: number, L: FrameLayout, info: FrameInfo, p: FramePalette): void {
  const u = L.unit
  const y = (L.y + u * 1.5) / 2 + u * 0.4
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${u * 2.2}px ${p.mono}`
  ctx.fillStyle = p.accent
  const w = spaced(ctx, 'SEVEN', L.x, y, u * 0.7)
  ctx.fillStyle = rgba(p.secondary, 0.85)
  spaced(ctx, '// CARRIED DATA', L.x + w + u * 1.4, y, u * 0.45)
  const date = new Date(info.at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
  ctx.fillStyle = info.locked ? p.secondary : 'rgba(255, 255, 255, 0.5)'
  const state = spaced(ctx, info.locked ? 'VAULT LOCKED' : 'OPEN', W - L.x, y, u * 0.45, true)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  spaced(ctx, `${date}  ·`, W - L.x - state - u * 1.2, y, u * 0.35, true)
}

function picture(ctx: CanvasRenderingContext2D, image: CanvasImageSource, iw: number, ih: number, L: FrameLayout, p: FramePalette): void {
  const u = L.unit
  const cut = u * 2.5
  ctx.save()
  chamfer(ctx, L.x, L.y, iw, ih, { tr: cut, bl: cut })
  ctx.clip()
  ctx.drawImage(image, L.x, L.y, iw, ih)
  ctx.restore()
  chamfer(ctx, L.x, L.y, iw, ih, { tr: cut, bl: cut })
  ctx.strokeStyle = rgba(p.secondary, 0.75)
  ctx.lineWidth = Math.max(1, u * 0.2)
  ctx.stroke()
  brackets(ctx, L.x, L.y, iw, ih, u, p.accent)
}

function footer(ctx: CanvasRenderingContext2D, W: number, ih: number, L: FrameLayout, info: FrameInfo, p: FramePalette): void {
  const u = L.unit
  const top = L.y + ih + u * 3
  const rule = ctx.createLinearGradient(L.x, 0, W - L.x, 0)
  rule.addColorStop(0, rgba(p.accent, 0.9))
  rule.addColorStop(0.6, rgba(p.secondary, 0.4))
  rule.addColorStop(1, rgba(p.secondary, 0))
  ctx.fillStyle = rule
  ctx.fillRect(L.x, top - u * 1.2, W - L.x * 2, Math.max(1, u * 0.15))

  ctx.textBaseline = 'middle'
  ctx.font = `700 ${u * 2.2}px ${p.mono}`
  const label = info.label.toUpperCase()
  const chipH = u * 3.6
  const chipW = spacedWidth(ctx, label, u * 0.5) + u * 3
  chamfer(ctx, L.x, top, chipW, chipH, { br: u * 1.2 })
  ctx.fillStyle = p.accent
  ctx.fill()
  ctx.fillStyle = p.base
  spaced(ctx, label, L.x + u * 1.5, top + chipH / 2, u * 0.5)
  if (info.also) {
    ctx.fillStyle = p.secondary
    spaced(ctx, `+${info.also} MORE INSIDE`, L.x + chipW + u * 1.5, top + chipH / 2, u * 0.4)
  }

  const stripW = Math.min(u * 30, (W - L.x * 2) * 0.35)
  const stripX = W - L.x - stripW
  ctx.textBaseline = 'alphabetic'
  ctx.font = `600 ${u * 5}px ${p.sans}`
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = rgba(p.accent, 0.35)
  ctx.shadowBlur = u * 1.5
  ctx.fillText(fit(ctx, info.title || 'Untitled', stripX - L.x - u * 3), L.x, top + chipH + u * 6)
  ctx.shadowBlur = 0

  const random = seeded(`${info.label}:${info.title}`)
  const barH = u * 6.5
  for (let x = stripX; x < stripX + stripW; ) {
    const bw = u * (0.3 + random() * 1.4)
    ctx.fillStyle = random() > 0.55 ? p.accent : rgba(p.secondary, 0.85)
    ctx.fillRect(x, top, Math.min(bw, stripX + stripW - x), barH)
    x += bw + u * (0.3 + random() * 0.8)
  }
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${u * 1.8}px ${p.mono}`
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
  const code = Math.floor(random() * 0xffffff).toString(16).toUpperCase().padStart(6, '0')
  spaced(ctx, `SVN-${code}`, stripX, top + barH + u * 2.2, u * 0.35)
  ctx.fillStyle = p.accent
  spaced(ctx, 'SEVEN CARD', W - L.x, top + barH + u * 2.2, u * 0.35, true)
}

export function drawCarryFrame(ctx: CanvasRenderingContext2D, image: CanvasImageSource, iw: number, ih: number, info: FrameInfo, p: FramePalette): FrameLayout {
  const L = frameLayout(iw, ih)
  backdrop(ctx, L.width, L.height, L.unit, p)
  card(ctx, L.width, L.height, L.unit, p)
  header(ctx, L.width, L, info, p)
  picture(ctx, image, iw, ih, L, p)
  footer(ctx, L.width, ih, L, info, p)
  return L
}
