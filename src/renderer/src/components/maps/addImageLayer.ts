import { ANY_ZOOM, newObject, type ImageLayerData, type MapData } from '@shared/maps'
import type { Point, Size } from '@shared/shapes'
import type { AssetMeta } from '@shared/types'
import { pickPicture } from '../data/PicturePicker'
import { assetUrl, useData } from '../../store/data'
import { imageSize } from '../../lib/imageSize'

export async function pickMapPicture(what: string): Promise<{ asset: AssetMeta; size: Size } | null> {
  const choice = await pickPicture(null, { what })
  if (!choice?.id) return null
  const asset = useData.getState().assets.find((a) => a.id === choice.id)
  return asset ? { asset, size: await imageSize(assetUrl(asset)) } : null
}

const nameOf = (asset: AssetMeta) => asset.name.replace(/\.[^.]+$/, '')

export async function addImageLayer(map: MapData, at: Point = { x: 0, y: 0 }): Promise<MapData | null> {
  const picked = await pickMapPicture('a picture for this map')
  if (!picked) return null
  const layer: ImageLayerData = { id: crypto.randomUUID(), kind: 'image', name: nameOf(picked.asset), visible: true, opacity: 1, offset: at, zoom: ANY_ZOOM, image: picked.asset.id, size: picked.size, scale: 1, rotation: 0 }
  return { ...map, size: map.layers.length ? map.size : picked.size, layers: [...map.layers, layer] }
}

export async function addObject(map: MapData, at: Point): Promise<{ map: MapData; id: string } | null> {
  const picked = await pickMapPicture('a picture for the object')
  if (!picked) return null
  const object = newObject(nameOf(picked.asset), picked.asset.id, picked.size, at)
  return { map: { ...map, layers: [...map.layers, object] }, id: object.id }
}
