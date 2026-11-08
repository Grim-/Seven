import type { Container } from 'pixi.js'
import type { GameEngine } from './GameEngine'
import type { Scene } from './Scene'

export class SceneManager {
  private stack: Scene[] = []

  constructor(
    private engine: GameEngine,
    private layer: Container
  ) {}

  get top(): Scene | null {
    return this.stack[this.stack.length - 1] ?? null
  }

  push(scene: Scene): void {
    const below = this.top
    if (below) below.root.visible = false
    this.stack.push(scene)
    this.layer.addChild(scene.root)
    scene.enter(this.engine)
  }

  pop(): void {
    const scene = this.stack.pop()
    if (!scene) return
    scene.exit()
    this.layer.removeChild(scene.root)
    scene.root.destroy({ children: true })
    const below = this.top
    if (below) below.root.visible = true
  }

  replace(scene: Scene): void {
    while (this.stack.length) this.pop()
    this.push(scene)
  }

  update(dt: number): void {
    this.top?.update(dt)
  }

  render(alpha: number): void {
    this.top?.render(alpha)
  }

  clear(): void {
    while (this.stack.length) this.pop()
  }
}
