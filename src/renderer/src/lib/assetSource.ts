import { engine, main } from './ipc'
import { assetUrl, useData } from '../store/data'

export function assetUrlOf(id: string): Promise<string | null> {
  if (id.startsWith('data:')) return Promise.resolve(id)
  return engine('data.assets.get', { id }).then(
    (a) => {
      useData.getState().onAsset(a.id, a)
      return assetUrl(a)
    },
    () => null
  )
}

export async function readImage(id: string): Promise<ImageBitmap | null> {
  if (id.startsWith('data:')) {
    try {
      const res = await fetch(id)
      const blob = await res.blob()
      return createImageBitmap(blob)
    } catch {
      return null
    }
  }
  const found = await main('assets.readImage', { id })
  return found ? createImageBitmap(new Blob([found.bytes], { type: found.mime })) : null
}
