import { showName } from '@shared/ids'
import { useEntryPreview } from './entryPreview'

export function useResolvedRef(kind: string, ref: string): { kind: string; id: string; title: string; label: string; missing: boolean } {
  const preview = useEntryPreview(`@${kind}:${ref}`)
  const found = preview && !('missing' in preview) ? preview : null
  return found
    ? { kind: found.kind, id: found.id, title: found.title, label: found.label, missing: false }
    : { kind, id: ref, title: showName(ref), label: kind.toUpperCase(), missing: Boolean(preview) }
}
