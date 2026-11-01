import { create } from 'zustand'

export interface PictureRequest {
  ids: string[]
  at: number
  seconds: number | null
}

export const usePictureViewer = create<{ request: PictureRequest | null }>(() => ({ request: null }))

export function openPictures(ids: string[], at = 0, seconds: number | null = null): void {
  if (!ids.length) return
  usePictureViewer.setState({ request: { ids, at: Math.min(Math.max(0, at), ids.length - 1), seconds } })
}

export function closePictures(): void {
  usePictureViewer.setState({ request: null })
}
