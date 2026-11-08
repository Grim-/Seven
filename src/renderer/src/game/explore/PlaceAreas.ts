import { Container, Graphics } from 'pixi.js'
import type { ShapeForm } from '@shared/shapes'
import type { GameEngine } from '../engine/GameEngine'
import { themeColour } from '../engine/theme'

interface Area {
  form: ShapeForm
  view: Graphics
}

function trace(g: Graphics, form: ShapeForm): Graphics {
  if (form.kind === 'box') return g.rect(form.x, form.y, form.w, form.h)
  return g.poly(form.points.flatMap((p) => [p.x, p.y]), true)
}

export class PlaceAreas {
  readonly root = new Container()
  private areas = new Map<string, Area>()
  private hovered: string | null = null
  private selected: string | null = null

  constructor(
    private engine: GameEngine,
    private tone = 'cyan'
  ) {}

  set(shapes: Record<string, ShapeForm>, selected: string | null): void {
    for (const [key, form] of Object.entries(shapes)) {
      const known = this.areas.get(key)
      if (known && known.form === form) continue
      known?.view.destroy()
      const view = new Graphics()
      this.areas.set(key, { form, view })
      this.root.addChild(view)
      this.paint(key)
    }
    for (const [key, area] of this.areas) {
      if (shapes[key]) continue
      area.view.destroy()
      this.areas.delete(key)
    }
    this.mark({ selected })
  }

  hover(key: string | null): void {
    this.mark({ hovered: key })
  }

  private mark(next: { hovered?: string | null; selected?: string | null }): void {
    const before = [this.hovered, this.selected]
    if (next.hovered !== undefined) this.hovered = next.hovered
    if (next.selected !== undefined) this.selected = next.selected
    for (const key of new Set([...before, this.hovered, this.selected])) if (key) this.paint(key)
  }

  private paint(key: string): void {
    const area = this.areas.get(key)
    if (!area) return
    const t = this.engine.theme
    const on = key === this.selected
    const near = key === this.hovered
    const tone = themeColour(t, this.tone, t.cyan)
    area.view.clear()
    trace(area.view, area.form)
      .fill({ color: on ? t.accent : tone, alpha: on ? 0.14 : near ? 0.1 : 0.04 })
      .stroke({ width: 1, color: on ? t.accent : tone, alpha: on ? 0.9 : near ? 0.8 : 0.4, pixelLine: true })
  }

  destroy(): void {
    this.root.destroy({ children: true })
    this.areas.clear()
  }
}
