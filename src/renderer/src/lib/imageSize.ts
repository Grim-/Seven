import type { Size } from '@shared/shapes'

export function imageSize(url: string): Promise<Size> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => reject(new Error('That picture could not be read'))
    img.src = url
  })
}
