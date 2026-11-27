import { usePlaces } from '../store/places'

export interface RecentEntry {
  kind: string
  id: string
  at: number
}

export const RECENT_PLACE_KEY = 'data.recent'
export const FILES_RECENT_PLACE_KEY = 'files.recent'
export const MAX_RECENT_ENTRIES = 10
const EMPTY: RecentEntry[] = []

function cleanRecent(raw: unknown, limit: number): RecentEntry[] {
  if (!Array.isArray(raw)) return EMPTY
  const seen = new Set<string>()
  const out: RecentEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Partial<RecentEntry>
    if (typeof r.kind !== 'string' || !r.kind || typeof r.id !== 'string' || !r.id) continue
    if (r.id === 'all' || r.id.startsWith('all:')) continue
    const key = `${r.kind}/${r.id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ kind: r.kind, id: r.id, at: typeof r.at === 'number' ? r.at : 0 })
    if (out.length >= limit) break
  }
  return out
}

function recentBucket(placeKey: string, limit = MAX_RECENT_ENTRIES) {
  return {
    use(): RecentEntry[] {
      const raw = usePlaces((s) => s.places[placeKey])
      return cleanRecent(raw, limit)
    },
    record(kind: string, id: string): void {
      if (!kind || !id || id === 'all' || id.startsWith('all:') || id === '__pending__' || id === '_new') return
      const current = cleanRecent(usePlaces.getState().places[placeKey], limit)
      const next: RecentEntry[] = [{ kind, id, at: Date.now() }, ...current.filter((e) => !(e.kind === kind && e.id === id))].slice(0, limit)
      usePlaces.getState().save(placeKey, next)
    },
    drop(gone: (entry: RecentEntry) => boolean): void {
      const current = cleanRecent(usePlaces.getState().places[placeKey], limit)
      const kept = current.filter((e) => !gone(e))
      if (kept.length !== current.length) usePlaces.getState().save(placeKey, kept)
    }
  }
}

const dataBucket = recentBucket(RECENT_PLACE_KEY)
const filesBucket = recentBucket(FILES_RECENT_PLACE_KEY)

export const useRecentEntries = dataBucket.use
export const recordOpenedEntry = dataBucket.record
export const useRecentFiles = filesBucket.use
export const recordOpenedFile = filesBucket.record

export function dropRecent(gone: (entry: RecentEntry) => boolean): void {
  dataBucket.drop(gone)
  filesBucket.drop(gone)
}
