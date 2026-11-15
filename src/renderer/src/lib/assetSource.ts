import { noteFailure } from '../store/problems'
import { engine, main } from './ipc'
import { assetUrl, useData } from '../store/data'

export function assetUrlOf(id: string): Promise<string | null> {
  if (!id) return Promise.resolve(null)
  if (id.startsWith('data:')) return Promise.resolve(id)
  return engine('data.assets.find', { id }).then(
    (a) => {
      if (!a) return null
      useData.getState().onAsset(a.id, a)
      return assetUrl(a)
    },
    (err: unknown) => (noteFailure('files', `Could not look up file ${id}`)(err), null)
  )
}

export async function readImage(id: string): Promise<ImageBitmap | null> {
  if (!id) return null
  if (id.startsWith('data:')) {
    try {
      const res = await fetch(id)
      const blob = await res.blob()
      return createImageBitmap(blob)
    } catch (err) {
      noteFailure('files', 'Could not read an embedded picture')(err)
      return null
    }
  }
  const found = await main('assets.readImage', { id })
  return found ? createImageBitmap(new Blob([found.bytes], { type: found.mime })) : null
}
