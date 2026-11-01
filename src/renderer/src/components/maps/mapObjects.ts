import { createContext, type MouseEvent } from 'react'
import type { LayerBase, ObjectLayerData, PictureLayer } from '@shared/maps'

export type PicturePatch = Partial<Pick<LayerBase & PictureLayer, 'offset' | 'scale' | 'rotation'>>

export interface MapObjectHandlers {
  selected?: string | null
  onPick?: (object: ObjectLayerData, e: MouseEvent) => void
  onMenu?: (object: ObjectLayerData, e: MouseEvent) => void
  onChange?: (id: string, patch: PicturePatch) => void
}

export const MapObjects = createContext<MapObjectHandlers>({})
