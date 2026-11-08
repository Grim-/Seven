import type { Point } from '@shared/shapes'
import type { GameEngine } from '../engine/GameEngine'
import { Label } from '../draw/label'

const OFFSET = 14

export class PlaceLabel {
  private label: Label
  private shown: string | null = null

  constructor(private engine: GameEngine) {
    this.label = new Label(engine.theme, 11, true)
    this.label.root.alpha = 0
    engine.overlay.addChild(this.label.root)
  }

  show(name: string | null, world: Point | null): void {
    if (name && world) {
      const v = this.engine.camera.current
      this.label.root.position.set(Math.round(world.x * v.zoom + v.x + OFFSET), Math.round(world.y * v.zoom + v.y + OFFSET))
    }
    if (name === this.shown) return
    this.shown = name
    if (name) this.label.set(name)
    this.engine.tweens.to(this.label.root, { alpha: name ? 1 : 0 }, name ? 0.15 : 0.25)
  }

  destroy(): void {
    this.engine.tweens.cancel(this.label.root)
    this.label.root.destroy({ children: true })
  }
}
