import { presentOf } from '../../registries/kinds'
import { EntrySlate } from './EntrySlate'
import { useEntryPreview } from './entryPreview'

export function EntryInspect({
  kind,
  refText,
  part = null,
  onClose
}: {
  kind: string
  refText: string
  part?: string | null
  onClose?: () => void
  pinned?: boolean
}) {
  const cleanRef = refText.replace(/^"|"$/g, '')
  const link = `@${kind}:${cleanRef}`
  const preview = useEntryPreview(link)
  const resolvedKind = preview && !('missing' in preview) ? preview.kind : kind
  const resolvedId = preview && !('missing' in preview) ? preview.id : cleanRef
  const Slate = presentOf(resolvedKind).Slate ?? EntrySlate

  return (
    <Slate
      kind={resolvedKind}
      id={resolvedId}
      part={part ?? ''}
      mode="slate"
      onRemove={onClose}
    />
  )
}
