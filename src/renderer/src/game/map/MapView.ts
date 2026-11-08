import { Container, Rectangle, Texture } from 'pixi.js'
import { mapPictureIds, showsAt, type MapData, type MapLayer, type ObjectLayerData, type Tileset } from '@shared/maps'
import { layerTypeOf } from '../../components/maps/layerTypes'
import '../../components/maps/layers'
import type { AssetManager } from '../engine/AssetManager'
import type { PaintContext } from './paint'

const ID_MASK = 0x1fffffff

function tilesetFor(sets: Tileset[], id: number): Tileset | undefined {
  let found: Tileset | undefined
  for (const t of sets) if (t.first <= id && (!found || t.first > found.first)) found = t
  return found
}

export class MapView {
  readonly root = new Container()
  private ids: string[] = []
  private frames = new Map<number, Texture | null>()
  private zoned: { layer: MapLayer; view: Container }[] = []

  private constructor(
    readonly map: MapData,
    private assets: AssetManager
  ) {}

  static async load(map: MapData, assets: AssetManager, object: (target: Container, layer: ObjectLayerData) => void): Promise<MapView> {
    const view = new MapView(map, assets)
    view.ids = mapPictureIds(map)
    const textures = await assets.useAll(view.ids)
    const ctx: PaintContext = {
      map,
      textures,
      object,
      tile: (gid) => view.frame(gid, textures),
      paint: (layers) => view.paint(layers, ctx)
    }
    view.root.addChild(view.paint(map.layers, ctx))
    return view
  }

  private frame(gid: number, textures: Map<string, Texture>): Texture | null {
    const id = gid & ID_MASK
    const known = this.frames.get(id)
    if (known !== undefined) return known
    const set = tilesetFor(this.map.tilesets, id)
    const sheet = set && textures.get(set.image)
    let texture: Texture | null = null
    if (set && sheet) {
      const local = id - set.first
      const x = set.margin + (local % set.columns) * (set.tile.w + set.spacing)
      const y = set.margin + Math.floor(local / set.columns) * (set.tile.h + set.spacing)
      if (x + set.tile.w <= sheet.width && y + set.tile.h <= sheet.height) texture = new Texture({ source: sheet.source, frame: new Rectangle(x, y, set.tile.w, set.tile.h) })
    }
    this.frames.set(id, texture)
    return texture
  }

  private paint(layers: MapLayer[], ctx: PaintContext): Container {
    const root = new Container()
    for (const layer of layers) {
      const painter = layerTypeOf(layer)?.paint
      if (!layer.visible || !painter) continue
      const view = new Container()
      view.position.set(layer.offset.x, layer.offset.y)
      view.alpha = layer.opacity
      view.addChild(painter(layer, ctx))
      if (layer.zoom.min !== null || layer.zoom.max !== null) this.zoned.push({ layer, view })
      root.addChild(view)
    }
    return root
  }

  zoomed(zoom: number): void {
    for (const z of this.zoned) z.view.visible = showsAt(z.layer, zoom)
  }

  destroy(): void {
    this.root.destroy({ children: true })
    for (const t of this.frames.values()) t?.destroy(false)
    this.frames.clear()
    this.assets.releaseAll(this.ids)
  }
}
