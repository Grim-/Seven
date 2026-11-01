import type { GroupLayerData, MapData } from '@shared/maps'
import { LayerStack } from '../LayerStack'
import { registerLayerType } from '../layerTypes'

export function GroupLayer({ layer, map }: { layer: GroupLayerData; map: MapData }) {
  return <LayerStack map={map} layers={layer.layers} />
}

registerLayerType('group', { tag: 'Group', Layer: GroupLayer })
