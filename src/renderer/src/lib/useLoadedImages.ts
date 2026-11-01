import { useEffect, useState } from 'react'

export function useImageLoad(urls: string[]): {
  images: Record<string, HTMLImageElement>
  failed: Record<string, true>
} {
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({})
  const [failed, setFailed] = useState<Record<string, true>>({})
  const key = urls.join('\n')
  useEffect(() => {
    let live = true
    for (const url of urls) {
      if (images[url] || failed[url]) continue
      const img = new Image()
      img.onload = () => live && setImages((s) => ({ ...s, [url]: img }))
      img.onerror = () => live && setFailed((s) => ({ ...s, [url]: true }))
      img.src = url
    }
    return () => {
      live = false
    }
  }, [key])
  return { images, failed }
}

export function useLoadedImages(urls: string[]): Record<string, HTMLImageElement> {
  return useImageLoad(urls).images
}
