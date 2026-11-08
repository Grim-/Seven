import type { Container, Texture } from 'pixi.js'
import type { MapData, MapLayer, ObjectLayerData } from '@shared/maps'

export interface PaintContext {
  map: MapData
  textures: Map<string, Texture>
  paint: (layers: MapLayer[]) => Container
  object: (target: Container, object: ObjectLayerData) => void
  tile: (gid: number) => Texture | null
}

export type LayerPainter<L extends MapLayer = MapLayer> = (layer: L, ctx: PaintContext) => Container
