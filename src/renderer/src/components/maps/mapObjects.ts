import { createContext } from 'react'
import type { MenuEvent } from '../ui/ContextMenu'
import type { LayerBase, ObjectLayerData, PictureLayer } from '@shared/maps'

export type PicturePatch = Partial<Pick<LayerBase & PictureLayer, 'offset' | 'scale' | 'rotation'>>

export interface MapObjectHandlers {
  selected?: string | null
  onPick?: (object: ObjectLayerData, e: MenuEvent) => void
  onMenu?: (object: ObjectLayerData, e: MenuEvent) => void
  onChange?: (id: string, patch: PicturePatch) => void
}

export const MapObjects = createContext<MapObjectHandlers>({})
