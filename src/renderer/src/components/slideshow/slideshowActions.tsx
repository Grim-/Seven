import { GalleryHorizontal, Plus } from 'lucide-react'
import { NEW_SLIDESHOW, cleanSlideshow, type Slideshow } from '@shared/slideshow'
import { showName } from '@shared/ids'
import { askText, type MenuItem } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { toast } from '../../store/toasts'
import { useData } from '../../store/data'
import { slideshowsIn } from './useSlideshow'

export function newSlideshow(pictures: string[], then: (made: Slideshow) => void = (s) => toast.success('Slideshow made', showName(s.title))): void {
  askText('New slideshow', 'Name', '', (title) =>
    engine('slideshows.save', { id: null, title, data: { ...NEW_SLIDESHOW, pictures } })
      .then(then)
      .catch(failed('Could not make the slideshow'))
  )
}

async function addTo(id: string, pictures: string[]): Promise<void> {
  const page = await engine('data.pages.get', { id })
  const show = cleanSlideshow(page.data)
  const added = pictures.filter((p) => !show.pictures.includes(p))
  await engine('slideshows.save', { id, title: page.title, data: { ...show, pictures: [...show.pictures, ...added] } })
  toast.success(added.length ? `Added to ${showName(page.title)}` : `Already in ${showName(page.title)}`, `${show.pictures.length + added.length} pictures`)
}

export function addToSlideshowMenu(pictures: string[]): MenuItem {
  return {
    label: 'Add to a slideshow',
    icon: <GalleryHorizontal />,
    children: [
      ...slideshowsIn(useData.getState().pages).map((s) => ({ label: showName(s.title), onSelect: () => void addTo(s.id, pictures).catch(failed('Could not add it')) })),
      { label: 'New slideshow…', icon: <Plus />, onSelect: () => newSlideshow(pictures) }
    ]
  }
}
