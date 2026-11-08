import { useContext } from 'react'
import type { ObjectLayerData } from '@shared/maps'
import { registerLayerType } from '../layerTypes'
import { paintPicture } from '../../../game/map/paintPicture'
import { MapObjects } from '../mapObjects'
import { PictureBox } from './PictureBox'

export function ObjectLayer({ layer }: { layer: ObjectLayerData }) {
  const handlers = useContext(MapObjects)
  const editing = Boolean(handlers.onChange)
  return (
    <PictureBox
      layer={layer}
      editing={editing}
      selected={handlers.selected === layer.id}
      hit={Boolean(handlers.onPick || handlers.onMenu || handlers.onChange)}
      onChange={(patch) => handlers.onChange?.(layer.id, patch)}
      onPress={(e) => handlers.onPick?.(layer, e)}
      onClick={(e) => !editing && handlers.onPick?.(layer, e)}
      onMenu={(e) => handlers.onMenu?.(layer, e)}
    />
  )
}

registerLayerType('object', {
  tag: 'Object',
  Layer: ObjectLayer,
  paint: (layer, ctx) => {
    const view = paintPicture(layer, ctx)
    ctx.object(view, layer)
    return view
  }
})
