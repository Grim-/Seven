import { registerBackgroundDrawer } from './drawers'
import { BaseBackground, rgbOf } from './base'

interface Look {
  scanSpeed: number
  scanAlpha: number
  glitchChance: number
  hudAlpha: number
  hudRefresh: [number, number]
  ghostMax: number
  ghostChance: number
  phrases: string[]
  cardMax: number
  cardChance: number
  cardOpacity: number
  tags: string[]
}

const CALM: Look = {
  scanSpeed: 0.08,
  scanAlpha: 0.15,
  glitchChance: 0.002,
  hudAlpha: 0.22,
  hudRefresh: [90, 220],
  ghostMax: 4,
  ghostChance: 0.05,
  phrases: ['// SYS.MEM.ALLOC', '0x000F8A92', 'TRACE_ROUTE: OK', '[FRAGMENT_IDLE]', 'AWAITING_INJECT...', 'DATA.DEKS.RDY', '0x88FF10', '// DECRYPTING'],
  cardMax: 3,
  cardChance: 0.012,
  cardOpacity: 0.32,
  tags: ['UDP', 'TCP', 'MEMORY']
}

const WARNING: Look = {
  scanSpeed: 0.15,
  scanAlpha: 0.3,
  glitchChance: 0.01,
  hudAlpha: 0.32,
  hudRefresh: [30, 80],
  ghostMax: 10,
  ghostChance: 0.2,
  phrases: ['ERR: FALLBACK_ENGAGED', 'MONOLITHIC_OVERRIDE', 'WARN_SYS_BYPASS', '0xDEADBEEF', 'INTRUSION_DETECTED'],
  cardMax: 6,
  cardChance: 0.03,
  cardOpacity: 0.45,
  tags: ['ERROR', 'OVERRIDE', 'PURGE', 'FLAG', 'LOCKOUT', 'ATTACK VECTOR', 'SHA-256']
}

const RED = '255, 30, 30'
const MARGIN = 30
const ARM = 40
const CARD_W = 42
const CARD_H = 58
const TICK = 8
const GLYPHS = ['#552', '@tag', '*_.', '', '>/>', '>>']
const WARNING_MS = 6000
const GLITCH_MS = 1400

interface Floater {
  text: string
  glyph: string
  x: number
  y: number
  life: number
  maxLife: number
  color: string
}

interface Hud {
  label: string
  align: CanvasTextAlign
  top: boolean
  value: string
  next: number
}

const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('')

function hudValue(label: string): string {
  if (label === 'SYS') return `SYS::${hex(6)}`
  if (label === 'MEM') return `MEM ${Math.floor(Math.random() * 40 + 20)}%`
  if (label === 'NET') return `NET ${Math.floor(Math.random() * 900 + 100)}kb/s`
  return `PROC ${Math.floor(Math.random() * 8 + 1)}/8`
}

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)]
const between = (min: number, max: number) => Math.random() * (max - min) + min

export class CyberdeckBackground extends BaseBackground {
  private ghosts: Floater[] = []
  private cards: Floater[] = []
  private huds: Hud[] = [
    { label: 'SYS', align: 'left' as CanvasTextAlign, top: true },
    { label: 'MEM', align: 'right' as CanvasTextAlign, top: true },
    { label: 'NET', align: 'left' as CanvasTextAlign, top: false },
    { label: 'PROC', align: 'right' as CanvasTextAlign, top: false }
  ].map((h) => ({ ...h, value: hudValue(h.label), next: 0 }))
  private interference: CanvasPattern | null = null
  private vignette: CanvasGradient | null = null
  private warningUntil = 0
  private glitchUntil = 0

  private get primary(): string {
    return performance.now() < this.warningUntil ? RED : rgbOf(this.colors.secondary)
  }

  private get secondary(): string {
    return rgbOf(this.colors.accent)
  }

  private get look(): Look {
    return performance.now() < this.warningUntil ? WARNING : CALM
  }

  protected onResize(): void {
    this.interference = null
    this.vignette = null
  }

  protected onColors(): void {
    this.interference = null
  }

  protected onReaction(name: string): void {
    const now = performance.now()
    if (name === 'warning') {
      this.warningUntil = now + WARNING_MS
      this.interference = null
    }
    if (name === 'glitch') this.glitchUntil = now + GLITCH_MS
  }

  private build(ctx: CanvasRenderingContext2D, primary: string): void {
    const tile = document.createElement('canvas')
    tile.width = 1
    tile.height = 4
    const t = tile.getContext('2d')!
    t.fillStyle = `rgba(${primary}, 0.015)`
    t.fillRect(0, 0, 1, 1)
    this.interference = ctx.createPattern(tile, 'repeat')
    const g = ctx.createRadialGradient(this.width / 2, this.height / 2, this.height * 0.35, this.width / 2, this.height / 2, this.height * 0.75)
    g.addColorStop(0, 'rgba(0, 0, 0, 0)')
    g.addColorStop(1, 'rgba(0, 0, 0, 0.015)')
    this.vignette = g
  }

  protected onFrame(dt: number, time: number): void {
    const ctx = this.ctx
    const k = dt * 60
    const look = this.look
    const primary = this.primary
    if (!this.interference || !this.vignette) this.build(ctx, primary)
    ctx.fillStyle = this.colors.base
    ctx.fillRect(0, 0, this.width, this.height)
    ctx.fillStyle = this.interference!
    ctx.fillRect(0, 0, this.width, this.height)
    this.framing(ctx, primary)
    this.hud(ctx, primary, look, k)
    this.floaters(ctx, look, primary, k)
    this.scanline(ctx, time, primary, look)
    ctx.fillStyle = this.vignette!
    ctx.fillRect(0, 0, this.width, this.height)
    if (performance.now() >= this.warningUntil && this.warningUntil) {
      this.warningUntil = 0
      this.interference = null
    }
  }

  private framing(ctx: CanvasRenderingContext2D, primary: string): void {
    const w = this.width
    const h = this.height
    ctx.strokeStyle = `rgba(${primary}, 0.15)`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(MARGIN, MARGIN + ARM)
    ctx.lineTo(MARGIN, MARGIN)
    ctx.lineTo(MARGIN + ARM, MARGIN)
    ctx.moveTo(w - MARGIN - ARM, MARGIN)
    ctx.lineTo(w - MARGIN, MARGIN)
    ctx.lineTo(w - MARGIN, MARGIN + ARM)
    ctx.moveTo(MARGIN, h - MARGIN - ARM)
    ctx.lineTo(MARGIN, h - MARGIN)
    ctx.lineTo(MARGIN + ARM, h - MARGIN)
    ctx.moveTo(w - MARGIN - ARM, h - MARGIN)
    ctx.lineTo(w - MARGIN, h - MARGIN)
    ctx.lineTo(w - MARGIN, h - MARGIN - ARM)
    ctx.stroke()
  }

  private hud(ctx: CanvasRenderingContext2D, primary: string, look: Look, k: number): void {
    ctx.font = '10px monospace'
    ctx.fillStyle = `rgba(${primary}, ${look.hudAlpha})`
    for (const h of this.huds) {
      h.next -= k
      if (h.next <= 0) {
        h.value = hudValue(h.label)
        h.next = between(look.hudRefresh[0], look.hudRefresh[1])
      }
      ctx.textAlign = h.align
      ctx.fillText(h.value, h.align === 'left' ? MARGIN + ARM + 12 : this.width - MARGIN - ARM - 12, h.top ? MARGIN + 14 : this.height - MARGIN - 10)
    }
    ctx.textAlign = 'left'
  }

  private spawn(list: Floater[], max: number, chance: number, k: number, margin: number, make: () => Pick<Floater, 'text' | 'glyph' | 'color'>, life: [number, number]): void {
    if (list.length >= max || Math.random() >= chance * k) return
    list.push({ ...make(), x: between(margin, this.width - margin), y: between(margin, this.height - margin), life: 0, maxLife: between(life[0], life[1]) })
  }

  private floaters(ctx: CanvasRenderingContext2D, look: Look, primary: string, k: number): void {
    const colour = (chance: number) => (Math.random() < chance ? this.secondary : primary)
    this.spawn(this.ghosts, look.ghostMax, look.ghostChance, k, 100, () => ({ text: pick(look.phrases), glyph: '', color: colour(0.2) }), [100, 250])
    this.spawn(this.cards, look.cardMax, look.cardChance, k, 90, () => ({ text: pick(look.tags), glyph: pick(GLYPHS), color: colour(0.25) }), [260, 440])

    ctx.font = '11px monospace'
    this.ghosts = this.ghosts.filter((g) => {
      g.life += k
      if (g.life >= g.maxLife) return false
      ctx.fillStyle = `rgba(${g.color}, ${Math.sin((g.life / g.maxLife) * Math.PI) * 0.4})`
      ctx.fillText(g.text, g.x, g.y)
      return true
    })

    ctx.font = '9px monospace'
    ctx.lineWidth = 1
    this.cards = this.cards.filter((c) => {
      c.life += k
      c.y -= 0.12 * k
      if (c.life >= c.maxLife) return false
      const alpha = Math.sin((c.life / c.maxLife) * Math.PI) * look.cardOpacity
      const l = c.x - CARD_W / 2
      const t = c.y - CARD_H / 2
      const r = c.x + CARD_W / 2
      const b = c.y + CARD_H / 2
      ctx.strokeStyle = `rgba(${c.color}, ${alpha})`
      ctx.beginPath()
      ctx.moveTo(l, t + TICK)
      ctx.lineTo(l, t)
      ctx.lineTo(l + TICK, t)
      ctx.moveTo(r - TICK, t)
      ctx.lineTo(r, t)
      ctx.lineTo(r, t + TICK)
      ctx.moveTo(l, b - TICK)
      ctx.lineTo(l, b)
      ctx.lineTo(l + TICK, b)
      ctx.moveTo(r - TICK, b)
      ctx.lineTo(r, b)
      ctx.lineTo(r, b - TICK)
      ctx.stroke()
      ctx.fillStyle = `rgba(${c.color}, ${alpha})`
      ctx.fillText(c.text, l + TICK + 2, t + TICK + 6)
      ctx.fillText(c.glyph, r - TICK - 8, b - TICK + 2)
      return true
    })
  }

  private scanline(ctx: CanvasRenderingContext2D, time: number, primary: string, look: Look): void {
    const y = (time * look.scanSpeed) % this.height
    const chance = performance.now() < this.glitchUntil ? 0.45 : look.glitchChance
    const glitching = Math.random() < chance
    const jitter = glitching ? (Math.random() - 0.5) * 40 : 0
    ctx.fillStyle = `rgba(${primary}, ${glitching ? 0.45 : look.scanAlpha})`
    ctx.fillRect(jitter, y, this.width, 2)
    const g = ctx.createLinearGradient(0, y - 80, 0, y)
    g.addColorStop(0, `rgba(${primary}, 0)`)
    g.addColorStop(1, `rgba(${primary}, 0.05)`)
    ctx.fillStyle = g
    ctx.fillRect(0, y - 80, this.width, 80)
  }
}

registerBackgroundDrawer('cyberdeck', CyberdeckBackground)
