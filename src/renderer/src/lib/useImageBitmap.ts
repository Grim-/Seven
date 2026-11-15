import { useEffect, useState } from 'react'
import { readImage } from './assetSource'

export function useImageBitmap(id: string | null): ImageBitmap | null {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  useEffect(() => {
    setBitmap(null)
    if (!id) return
    let live = true
    let loaded: ImageBitmap | null = null
    void readImage(id)
      .then((b) => {
        if (!live) {
          b?.close()
          return
        }
        loaded = b
        setBitmap(b)
      })
      .catch(() => live && setBitmap(null))
    return () => {
      live = false
      loaded?.close()
    }
  }, [id])
  return bitmap
}
