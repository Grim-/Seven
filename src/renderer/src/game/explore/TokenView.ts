import { Container, Graphics, Sprite, type Texture } from 'pixi.js'
import type { Point } from '@shared/shapes'
import { showName } from '@shared/ids'
import type { MapToken } from '../../components/maps/TokenLayer'
import type { GameEngine } from '../engine/GameEngine'
import { EASE } from '../engine/Tweens'
import { drawBar } from '../draw/bar'
import { Label } from '../draw/label'
import { squareCrop } from '../draw/portrait'

export interface TokenBar {
  value: number
  colour: string
}

export interface TokenLook {
  base: number
  smallest: number
  label: boolean
  border: string
}

const BAR = 5
const STEP_HEIGHT = 3

export class TokenView {
  readonly root = new Container()
  private body = new Container()
  private portrait = new Sprite()
  private frame = new Graphics()
  private bar = new Graphics()
  private label: Label | null
  private image: string | null = null
  private crop: Texture | null = null
  private side = 0
  private zoom = 0
  private dragging = false
  private walking = false
  private bars: TokenBar[] | null = null

  constructor(
    private engine: GameEngine,
    public token: MapToken,
    private look: TokenLook
  ) {
    this.label = look.label ? new Label(engine.theme) : null
    this.portrait.visible = false
    this.body.addChild(this.portrait, this.frame, this.bar)
    if (this.label) this.body.addChild(this.label.root)
    this.root.addChild(this.body)
    this.root.position.set(token.at.x, token.at.y)
    this.root.cullable = true
    this.body.alpha = 0
    this.body.scale.set(0.6)
    engine.tweens.to(this.body, { alpha: 1 }, 0.25)
    engine.tweens.to(this.body.scale, { x: 1, y: 1 }, 0.35, EASE.back)
    this.update(token)
  }

  get sheet(): string {
    return this.token.visitor.sheet
  }

  update(token: MapToken): void {
    const moved = token.at.x !== this.token.at.x || token.at.y !== this.token.at.y
    this.token = token
    const v = token.visitor
    if (v.image !== this.image) void this.usePortrait(v.image)
    const labelChanged = this.label?.set(showName(v.name))
    if (moved && !this.dragging && !this.walking) this.engine.tweens.to(this.root.position, { x: token.at.x, y: token.at.y }, 0.35, EASE.inOut)
    if (labelChanged || !this.zoom) this.zoom = 0
  }

  setBars(bars: TokenBar[] | null): void {
    const same = bars && this.bars && bars.length === this.bars.length && bars.every((b, i) => b.value === this.bars![i].value && b.colour === this.bars![i].colour)
    if (same || (!bars && !this.bars)) return
    this.bars = bars
    this.zoom = 0
  }

  setBorder(color: string): void {
    if (this.look.border === color) return
    this.look = { ...this.look, border: color }
    this.zoom = 0
  }

  private async usePortrait(image: string | null): Promise<void> {
    if (this.image) this.engine.assets.release(this.image)
    this.crop?.destroy(false)
    this.crop = null
    this.image = image
    const texture = image ? await this.engine.assets.use(image) : null
    if (this.image !== image || this.root.destroyed) return
    this.crop = texture ? squareCrop(texture) : null
    this.portrait.texture = this.crop ?? this.portrait.texture
    this.portrait.visible = Boolean(this.crop)
    this.zoom = 0
    this.engine.invalidate()
  }

  get at(): Point {
    return { x: this.root.position.x, y: this.root.position.y }
  }

  walkTo(at: Point, steps: number): void {
    this.walking = true
    this.engine.tweens.cancel(this.root.position)
    this.root.position.set(at.x, at.y)
    this.body.y = -Math.abs(Math.sin(steps * Math.PI)) * STEP_HEIGHT
  }

  stopWalking(): void {
    this.walking = false
    this.engine.tweens.to(this.body, { y: 0 }, 0.12)
  }

  drag(at: Point): void {
    this.dragging = true
    this.engine.tweens.cancel(this.root.position)
    this.root.position.set(at.x, at.y)
  }

  drop(): void {
    this.dragging = false
  }

  snapBack(): void {
    this.dragging = false
    this.engine.tweens.to(this.root.position, { x: this.token.at.x, y: this.token.at.y }, 0.3, EASE.out)
  }

  layout(zoom: number): void {
    if (zoom === this.zoom) return
    this.zoom = zoom
    const side = Math.max(this.look.smallest, this.look.base * zoom)
    this.side = side
    this.root.scale.set(1 / zoom)
    this.portrait.width = side
    this.portrait.height = side
    this.portrait.position.set(-side / 2, -side / 2)
    this.frame.clear()
    this.frame.rect(-side / 2, -side / 2, side, side)
    if (!this.portrait.visible) this.frame.fill({ color: this.engine.theme.card, alpha: 0.95 })
    this.frame.stroke({ width: 2, color: this.look.border })
    const hp = this.token.visitor.dnd?.hp
    const bars = this.bars ?? (hp ? [{ value: hp.max ? hp.cur / hp.max : 0, colour: hp.max && hp.cur / hp.max < 0.4 ? this.engine.theme.alert : this.engine.theme.cyan }] : [])
    this.bar.clear()
    bars.forEach((b, i) => drawBar(this.bar, side, BAR, b.value, b.colour, this.engine.theme.bg, i * (BAR + 1)))
    this.bar.visible = bars.length > 0
    this.bar.position.set(-side / 2, side / 2 + 3)
    const under = bars.length ? bars.length * (BAR + 1) + 5 : 4
    if (this.label) this.label.root.position.set(-this.label.width / 2, side / 2 + under)
  }

  get size(): number {
    return this.side
  }

  destroy(): void {
    this.engine.tweens.cancel(this.body)
    this.engine.tweens.cancel(this.body.scale)
    this.engine.tweens.cancel(this.root.position)
    this.engine.input.unbind(this.root)
    if (this.image) this.engine.assets.release(this.image)
    this.crop?.destroy(false)
    this.root.destroy({ children: true })
  }
}
