import type { Container } from 'pixi.js'
import type { GameEngine } from './GameEngine'

export interface Scene {
  readonly root: Container
  enter(engine: GameEngine): void
  exit(): void
  update(dt: number): void
  render(alpha: number): void
  active?(): boolean
  visualActive?(): boolean
}
