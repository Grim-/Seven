import { engine, main } from './ipc'
import { assetUrl, useData } from '../store/data'

export function assetUrlOf(id: string): Promise<string | null> {
  return engine('data.assets.get', { id }).then(
    (a) => {
      useData.getState().onAsset(a.id, a)
      return assetUrl(a)
    },
    () => null
  )
}

export async function readImage(id: string): Promise<ImageBitmap | null> {
  const found = await main('assets.readImage', { id })
  return found ? createImageBitmap(new Blob([found.bytes], { type: found.mime })) : null
}
