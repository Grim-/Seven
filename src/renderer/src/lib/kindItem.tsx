import { hitDetail, type LibraryHit, type LibrarySection } from '@shared/types'
import { showName } from '@shared/ids'
import type { ShellItem } from '../components/ui'
import { presentOf } from '../registries/kinds'
import { KindIcon } from './library'

export function kindItem(section: Pick<LibrarySection, 'kind' | 'icon'>, h: LibraryHit): ShellItem {
  const { Thumb, Face } = presentOf(section.kind)
  return {
    key: h.id,
    title: showName(h.title),
    subtitle: [hitDetail(h), h.tags?.length ? `#${h.tags.join(' #')}` : ''].filter(Boolean).join(' · ') || undefined,
    excerpt: h.excerpt,
    icon: <KindIcon name={section.icon} className="h-4 w-4" />,
    thumb: Thumb ? <Thumb id={h.id} large /> : undefined,
    face: Face ? <Face id={h.id} /> : undefined,
    kind: section.kind,
    tags: h.tags,
    updatedAt: h.at
  }
}
