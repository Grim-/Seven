import type { ComponentType } from 'react'
import type { MapLayer, MapData } from '@shared/maps'
import type { LayerPainter } from '../../game/map/paint'

export interface LayerType<L extends MapLayer = MapLayer> {
  tag: string
  Layer: ComponentType<{ layer: L; map: MapData }>
  paint?: LayerPainter<L>
}

const types = new Map<string, LayerType>()

export function registerLayerType<K extends MapLayer['kind']>(kind: K, type: LayerType<Extract<MapLayer, { kind: K }>>): void {
  types.set(kind, type as LayerType)
}

export function layerTypeOf(layer: MapLayer): LayerType | undefined {
  return types.get(layer.kind)
}
