import { useContext } from 'react'
import type { ImageLayerData } from '@shared/maps'
import { registerLayerType } from '../layerTypes'
import { paintPicture } from '../../../game/map/paintPicture'
import { MapObjects } from '../mapObjects'
import { PictureBox } from './PictureBox'

export function ImageLayer({ layer }: { layer: ImageLayerData }) {
  const handlers = useContext(MapObjects)
  const editing = Boolean(handlers.onChange) && handlers.selected === layer.id
  return <PictureBox layer={layer} editing={editing} selected={editing} hit={editing} onChange={(patch) => handlers.onChange?.(layer.id, patch)} />
}

registerLayerType('image', { tag: 'Image', Layer: ImageLayer, paint: paintPicture })
