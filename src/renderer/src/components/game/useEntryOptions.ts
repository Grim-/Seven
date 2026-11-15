import type { BrowseOption } from '../ui/BrowsePick'
import { engine } from '../../lib/ipc'
import { useKindInfos } from '../../lib/kinds'
import { useLibraryData } from '../../lib/useLive'

export function useEntryOptions(kind: string): BrowseOption[] {
  const hits = useLibraryData(() => engine('library.find', { query: '', kind }), `entries.${kind}`) ?? []
  const group = useKindInfos().find((k) => k.kind === kind)?.label ?? kind
  return hits.map((h) => ({ value: h.id, label: h.title, group, note: h.summary || undefined }))
}
