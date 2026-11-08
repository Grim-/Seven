import { useEffect, useState } from 'react'
import { mapPictureIds, type MapData } from '@shared/maps'
import { useImageLoad } from '../../lib/useLoadedImages'
import { assetUrlOf } from '../../lib/assetSource'

export function useMapPictures(map: MapData | null | false): { done: number; total: number } {
  const ids = map ? mapPictureIds(map) : []
  const key = ids.join(',')
  const [found, setFound] = useState<{ urls: string[]; missing: number } | null>(null)
  useEffect(() => {
    let live = true
    setFound(null)
    void Promise.all(ids.map(assetUrlOf)).then(
      (list) =>
        live &&
        setFound({
          urls: list.filter((u): u is string => u !== null),
          missing: list.filter((u) => u === null).length
        })
    )
    return () => {
      live = false
    }
  }, [key])
  const { images, failed } = useImageLoad(found?.urls ?? [])
  const done = found ? found.missing + found.urls.filter((u) => images[u] || failed[u]).length : 0
  return { done, total: ids.length }
}
