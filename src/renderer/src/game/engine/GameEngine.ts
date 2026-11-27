import { Application, Container, Culler } from 'pixi.js'
import 'pixi.js/unsafe-eval'
import { AssetManager, type ImageSource } from './AssetManager'
import { Camera } from './Camera'
import { Input } from './Input'
import { Loop } from './Loop'
import { SceneManager } from './SceneManager'
import { Tweens } from './Tweens'
import { readTheme, type GameTheme } from './theme'

export class GameEngine {
  readonly app = new Application()
  readonly tweens = new Tweens()
  readonly camera = new Camera()
  readonly overlay = new Container()
  readonly theme: GameTheme = readTheme()
  readonly assets: AssetManager
  readonly scenes: SceneManager
  input!: Input
  private loop: Loop
  private observer: ResizeObserver | null = null
  private alive = true
  private dirty = true

  private constructor(
    private host: HTMLElement,
    source: ImageSource
  ) {
    this.assets = new AssetManager(source)
    this.scenes = new SceneManager(this, this.camera.world)
    const wake = () => this.invalidate()
    this.tweens.onWake = wake
    this.camera.onWake = wake
    this.scenes.onWake = wake
    this.loop = new Loop(
      (dt) => this.update(dt),
      (alpha) => this.render(alpha),
      () => this.alive && !document.hidden && (this.dirty || this.tweens.active || this.camera.animating || Boolean(this.scenes.top?.active?.()))
    )
  }

  static async create(host: HTMLElement, source: ImageSource): Promise<GameEngine> {
    const engine = new GameEngine(host, source)
    const resolution = Math.min(window.devicePixelRatio || 1, 1.5)
    await engine.app.init({ backgroundAlpha: 0, antialias: false, autoStart: false, autoDensity: true, resolution, preference: 'webgl', width: Math.max(1, host.clientWidth), height: Math.max(1, host.clientHeight) })
    host.appendChild(engine.app.canvas)
    engine.app.canvas.style.display = 'block'
    engine.app.stage.addChild(engine.camera.world, engine.overlay)
    engine.input = new Input(engine.app, engine.camera, () => engine.invalidate())
    engine.watch()
    return engine
  }

  invalidate(): void {
    if (!this.alive) return
    this.dirty = true
    if (!document.hidden && this.host.clientWidth && this.host.clientHeight) this.loop.start()
  }

  private watch(): void {
    const resize = () => {
      const w = this.host.clientWidth
      const h = this.host.clientHeight
      if (!w || !h) return this.loop.stop()
      this.app.renderer.resize(w, h)
      this.camera.setScreen({ w, h })
      this.invalidate()
    }
    this.observer = new ResizeObserver(resize)
    this.observer.observe(this.host)
    document.addEventListener('visibilitychange', this.visibility)
    resize()
  }

  private visibility = (): void => {
    if (document.hidden) this.loop.stop()
    else this.invalidate()
  }

  private update(dt: number): void {
    this.tweens.update(dt)
    this.camera.update(dt)
    this.scenes.update(dt)
  }

  private render(alpha: number): void {
    if (!this.dirty && !this.tweens.active && !this.camera.animating && !this.scenes.top?.visualActive?.()) return
    this.dirty = false
    this.scenes.render(alpha)
    Culler.shared.cull(this.camera.world, this.app.screen, false)
    this.app.render()
  }

  destroy(): void {
    if (!this.alive) return
    this.alive = false
    this.loop.stop()
    this.observer?.disconnect()
    document.removeEventListener('visibilitychange', this.visibility)
    this.scenes.clear()
    this.input.destroy()
    this.tweens.clear()
    this.app.destroy(true, { children: true })
    this.assets.destroy()
  }
}
