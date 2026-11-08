import { Container, Graphics } from 'pixi.js'
import type { Point } from '@shared/shapes'
import type { GameEngine } from '../engine/GameEngine'
import { EASE } from '../engine/Tweens'

const RADIUS = 9
const FADE = 0.3

export class MoveMarker {
  readonly root = new Container()
  private ring = new Graphics()

  constructor(private engine: GameEngine) {
    this.root.eventMode = 'none'
    this.root.visible = false
    this.root.addChild(this.ring)
  }

  show(at: Point, reachable: boolean): void {
    const color = reachable ? this.engine.theme.accent : this.engine.theme.alert
    this.ring.clear()
    this.ring.circle(0, 0, RADIUS).stroke({ width: 2, color })
    this.ring.circle(0, 0, 2.5).fill({ color })
    this.engine.tweens.cancel(this.root)
    this.root.position.set(at.x, at.y)
    this.root.visible = true
    this.root.alpha = 1
    this.ring.scale.set(1.8)
    this.engine.tweens.to(this.ring.scale, { x: 1, y: 1 }, 0.25, EASE.out)
    if (!reachable) this.hide(0.6)
  }

  hide(delay = 0): void {
    const total = FADE + delay
    const wait = delay / total
    this.engine.tweens.to(this.root, { alpha: 0 }, total, (t) => (t < wait ? 0 : EASE.out((t - wait) / (1 - wait))), () => {
      this.root.visible = false
    })
  }

  layout(zoom: number): void {
    this.root.scale.set(1 / zoom)
  }

  destroy(): void {
    this.engine.tweens.cancel(this.root)
    this.engine.tweens.cancel(this.ring.scale)
    this.root.destroy({ children: true })
  }
}
