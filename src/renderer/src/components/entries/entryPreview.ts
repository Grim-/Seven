import { useEffect } from 'react'
import { create } from 'zustand'
import type { EntryPreview } from '@shared/types'
import { engine } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { useData } from '../../store/data'

export type PreviewState = EntryPreview | { missing: string }

const useCache = create<{ items: Record<string, PreviewState> }>(() => ({ items: {} }))
const asked = new Set<string>()

useData.subscribe((s, prev) => {
  if (s.pages === prev.pages && s.assets === prev.assets) return
  asked.clear()
  useCache.setState({ items: {} })
})

export function useEntryPreview(link: string): PreviewState | undefined {
  const item = useCache((s) => s.items[link])
  useEffect(() => {
    if (item || asked.has(link)) return
    asked.add(link)
    void engine('library.preview', { entry: link })
      .then((preview) => useCache.setState((s) => ({ items: { ...s.items, [link]: preview } })))
      .catch((err) => useCache.setState((s) => ({ items: { ...s.items, [link]: { missing: errorText(err) } } })))
  }, [link, item])
  return item
}
