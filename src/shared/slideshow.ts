import { isAssetId } from './ids'
export const SLIDESHOW_TYPE = 'slideshow'

export type SlideshowFit = 'contain' | 'cover'

export interface SlideshowData {
  pictures: string[]
  seconds: number
  shuffle: boolean
  fit: SlideshowFit
  captions: boolean
}

export interface Slideshow extends SlideshowData {
  id: string
  title: string
  updatedAt: number
}

export const NEW_SLIDESHOW: SlideshowData = { pictures: [], seconds: 8, shuffle: false, fit: 'contain', captions: false }

export function cleanSlideshow(raw: unknown): SlideshowData {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof SlideshowData, unknown>>
  const pictures = Array.isArray(d.pictures) ? [...new Set(d.pictures.filter(isAssetId))] : []
  const seconds = typeof d.seconds === 'number' && Number.isFinite(d.seconds) && d.seconds > 0 ? d.seconds : NEW_SLIDESHOW.seconds
  return { pictures, seconds, shuffle: d.shuffle === true, fit: d.fit === 'cover' ? 'cover' : 'contain', captions: d.captions === true }
}
