import { Container, Graphics, Text } from 'pixi.js'
import type { GameTheme } from '../engine/theme'

export class Label {
  readonly root = new Container()
  private back = new Graphics()
  private text: Text

  constructor(
    private theme: GameTheme,
    size = 11,
    private upper = false
  ) {
    this.text = new Text({ text: '', style: { fontFamily: theme.font, fontSize: size, fill: theme.text, fontWeight: upper ? '700' : '400', letterSpacing: upper ? 1.5 : 0 } })
    this.text.position.set(6, 2)
    this.root.addChild(this.back, this.text)
  }

  set(value: string): boolean {
    const shown = this.upper ? value.toUpperCase() : value
    if (this.text.text === shown) return false
    this.text.text = shown
    this.back.clear()
    this.back.rect(0, 0, this.width, this.height).fill({ color: this.theme.bg, alpha: 0.88 }).stroke({ width: 1, color: this.theme.line })
    return true
  }

  get width(): number {
    return this.text.width + 12
  }

  get height(): number {
    return this.text.height + 4
  }
}
