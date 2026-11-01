import type { ComponentType } from 'react'
import { EmptyState } from '../ui'
import { assetUrl, useAsset, usePage } from '../../store/data'
import { LiveNote } from './NoteView'
import { LiveCollection } from './CollectionView'
import { checkField } from './fields'
import { TextPart } from './TextPart'
import { cn } from '../../lib/cn'
import type { EntrySurfaceProps } from '../../registries/kinds'

export function PagePicture({ id, large = false }: { id: string; large?: boolean }) {
  const page = usePage(id)
  const picture = useAsset(page?.image ?? '')
  if (page === undefined) return null
  if (!page?.image || !picture) return <EmptyState title="No picture">This page has no picture yet.</EmptyState>
  return <img src={assetUrl(picture)} alt={page.title} className={cn('w-auto max-w-full border border-line/50 object-contain', large ? 'max-h-[78vh]' : 'max-h-[420px]')} />
}

export function PageItems({ id }: { id: string }) {
  const page = usePage(id)
  if (!page) return null
  return <LiveCollection collectionId={id} view={page.view ?? (checkField(page) ? 'checklist' : 'table')} recordIds={null} />
}

const PARTS: Record<string, ComponentType<{ id: string; large?: boolean }>> = { items: PageItems, picture: PagePicture }

function PagePart({ id, part, large }: EntrySurfaceProps & { large: boolean }) {
  if (id.startsWith('all:')) return <TextPart entry={`page/${id}`} />
  const Part = PARTS[part]
  return Part ? <Part id={id} large={large} /> : <LiveNote noteId={id} />
}

export function PageChat(props: EntrySurfaceProps) {
  return <PagePart {...props} large={false} />
}

export function PageStage(props: EntrySurfaceProps) {
  return (
    <div className="text-[16px] leading-relaxed">
      <PagePart {...props} large />
    </div>
  )
}
