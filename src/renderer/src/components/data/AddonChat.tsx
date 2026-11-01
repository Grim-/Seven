import { usePage } from '../../store/data'
import { ModulePageView } from '../present/template'
import { PagePicture } from './PageChat'
import type { EntrySurfaceProps } from '../../registries/kinds'

export function AddonChat({ id, part }: EntrySurfaceProps) {
  const page = usePage(id)
  if (!page) return null
  if (part === 'picture') return <PagePicture id={id} />
  return <ModulePageView pageId={id} version={page.version} part={part} />
}
