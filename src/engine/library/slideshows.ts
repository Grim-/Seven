import { SLIDESHOW_TYPE, cleanSlideshow, type Slideshow, type SlideshowData } from '@shared/slideshow'
import { data } from '../data/hub'

export function slideshowIds(): { id: string; title: string; updatedAt: number }[] {
  return data.pages.ofType(SLIDESHOW_TYPE).map((p) => ({ id: p.id, title: p.title, updatedAt: p.updatedAt }))
}

export function findSlideshow(ref: string): string | null {
  return data.pages.find(ref, (p) => p.type === SLIDESHOW_TYPE)?.id ?? null
}

export function getSlideshow(ref: string): Slideshow {
  const page = data.pages.get(ref)
  if (page.type !== SLIDESHOW_TYPE) throw new Error(`${page.title} is not a slideshow. find with kind slideshow lists them.`)
  return { id: page.id, title: page.title, updatedAt: page.updatedAt, ...cleanSlideshow(page.data) }
}

export function createSlideshow(title: string, value: SlideshowData): Slideshow {
  const page = data.pages.create({ title, type: SLIDESHOW_TYPE, data: cleanSlideshow(value) })
  return getSlideshow(page.id)
}

export function saveSlideshow(ref: string, value: SlideshowData): Slideshow {
  const current = getSlideshow(ref)
  data.pages.setData(current.id, cleanSlideshow(value))
  return getSlideshow(current.id)
}

export function slideshowText(ref: string): string {
  const s = getSlideshow(ref)
  const names = s.pictures.map((id) => {
    const meta = data.assets.metaFor(id)
    return `- ${meta ? meta.name : 'a removed file'} (file ${id})`
  })
  return [`# ${s.title}`, `Slideshow of ${s.pictures.length} picture${s.pictures.length === 1 ? '' : 's'}, ${s.seconds} seconds each, ${s.shuffle ? 'shuffled' : 'in order'}, ${s.fit === 'cover' ? 'filling the space' : 'whole pictures'}${s.captions ? ', with captions' : ''}.`, ...names].join('\n')
}
