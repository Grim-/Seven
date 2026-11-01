import { pageKindOf } from '@shared/types'
import { useData } from '../../store/data'
import { openEntry } from '../../lib/library'
import { PageExplorer } from './PageExplorer'
import type { EntrySurfaceProps } from '../../registries/kinds'

export function FolderChat({ id }: EntrySurfaceProps) {
  const pages = useData((s) => s.pages)
  return <PageExplorer folder={id} onOpen={(next) => next && openEntry(pageKindOf(pages.find((p) => p.id === next)?.type), next)} />
}
