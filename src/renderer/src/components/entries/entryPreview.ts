import { useEffect } from 'react'
import { create } from 'zustand'
import type { EntryPreview } from '@shared/types'
import { engine } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { useData } from '../../store/data'

export type PreviewState = EntryPreview | { missing: string }

const useCache = create<{ items: Record<string, PreviewState> }>(() => ({ items: {} }))
const asked = new Set<string>()
const refs = new Map<string, number>()

function fetchPreview(link: string): void {
  if (!link || asked.has(link)) return
  asked.add(link)
  void engine('library.preview', { entry: link })
    .then((preview) =>
      useCache.setState((s) => {
        if (!refs.get(link)) return s
        const cur = s.items[link]
        if (cur && !('missing' in cur) && cur.id === preview.id && cur.title === preview.title && cur.image === preview.image && cur.card === preview.card) {
          return s
        }
        return { items: { ...s.items, [link]: preview } }
      })
    )
    .catch((err) =>
      useCache.setState((s) => {
        if (!refs.get(link)) return s
        const msg = errorText(err)
        const cur = s.items[link]
        if (cur && 'missing' in cur && cur.missing === msg) return s
        return { items: { ...s.items, [link]: { missing: msg } } }
      })
    )
}

useData.subscribe((s, prev) => {
  if (s.pages === prev.pages && s.assets === prev.assets) return
  asked.clear()
  for (const [link, count] of refs) {
    if (count > 0) fetchPreview(link)
  }
})

export function useEntryPreview(link: string): PreviewState | undefined {
  const item = useCache((s) => (link ? s.items[link] : undefined))
  useEffect(() => {
    if (!link) return
    refs.set(link, (refs.get(link) ?? 0) + 1)
    if (!useCache.getState().items[link] && !asked.has(link)) fetchPreview(link)
    return () => {
      const next = (refs.get(link) ?? 0) - 1
      if (next > 0) {
        refs.set(link, next)
        return
      }
      refs.delete(link)
      asked.delete(link)
      useCache.setState((s) => {
        if (!(link in s.items)) return s
        const items = { ...s.items }
        delete items[link]
        return { items }
      })
    }
  }, [link])
  return item
}
