import { shuffled } from '@shared/random'
import { useMemo } from 'react'
import { useStepper } from '../pictures/useStepper'
import { cleanSlideshow, type Slideshow } from '@shared/slideshow'
import { SLIDESHOW_TYPE } from '@shared/slideshow'
import type { PageMeta } from '@shared/types'
import { usePage, useData } from '../../store/data'
import { useStage } from '../../registries/presentations'

export function slideshowsIn(pages: PageMeta[]): PageMeta[] {
  return pages.filter((p) => p.type === SLIDESHOW_TYPE)
}

export function useSlideshows(): PageMeta[] {
  const pages = useData((s) => s.pages)
  return useMemo(() => slideshowsIn(pages), [pages])
}

export function useSlideshow(id: string | null): Slideshow | null | undefined {
  const page = usePage(id)
  return useMemo(() => (page ? { id: page.id, title: page.title, updatedAt: page.updatedAt, ...cleanSlideshow(page.data) } : page), [page])
}

export function useCycle(pictures: string[], seconds: number, shuffle: boolean, playing: boolean): { order: string[]; index: number; step: (by: number) => void } {
  const key = pictures.join(',')
  const order = useMemo(() => (shuffle ? shuffled(pictures) : pictures), [key, shuffle])
  const { index, step } = useStepper(order.length, 0, seconds, playing)
  return { order, index, step }
}

export function playSlideshow(id: string): void {
  useStage.getState().play({ type: 'entry', fields: { kind: 'slideshow', id }, where: 'stage', key: null })
}
