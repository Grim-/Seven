import { noteFailure, reportProblem } from './problems'
import { FOLDER_TYPE, idSegment, stripRef, toId } from '@shared/ids'
import { useEffect } from 'react'
import { create } from 'zustand'
import type { AssetMeta, Page, PageMeta } from '@shared/types'
import { linkFor } from '@shared/text'
import { engine } from '../lib/ipc'
import { remoteAssetUrl } from '../lib/transport'

export type DataSelection = { kind: string; id: string }

interface DataState {
  pages: PageMeta[]
  assets: AssetMeta[]
  full: Record<string, Page | null>
  missingAssets: Record<string, true>
  refresh: () => Promise<void>
  loadPage: (id: string) => Promise<void>
  onPage: (id: string, meta: PageMeta | null) => void
  onAsset: (id: string, meta: AssetMeta | null) => void
}

function upsert<T extends { id: string }>(list: T[], id: string, item: T | null): T[] {
  if (!item) return list.filter((x) => x.id !== id)
  const index = list.findIndex((x) => x.id === id)
  if (index === -1) return [item, ...list]
  const next = [...list]
  next[index] = item
  return next
}

const pending = new Set<string>()

export const useData = create<DataState>((set, get) => ({
  pages: [],
  assets: [],
  full: {},
  missingAssets: {},
  refresh: async () => {
    const [pages, assets] = await Promise.all([engine('data.pages.list'), engine('data.assets.list')])
    set({ pages, assets })
    for (const id of Object.keys(get().full)) void get().loadPage(id)
  },
  loadPage: async (id) => {
    if (pending.has(id)) return
    pending.add(id)
    try {
      const page = await engine('data.pages.find', { id }).catch((err: unknown) => (noteFailure('data', 'Could not load a page')(err), null))
      set((s) => ({ full: { ...s.full, [id]: page } }))
    } finally {
      pending.delete(id)
    }
  },
  onPage: (id, meta) => {
    set((s) => ({ pages: upsert(s.pages, id, meta).sort((a, b) => a.title.localeCompare(b.title)) }))
    if (id in get().full) {
      if (meta) void get().loadPage(id)
      else set((s) => ({ full: { ...s.full, [id]: null } }))
    }
  },
  onAsset: (id, meta) =>
    set((s) => {
      const missingAssets = { ...s.missingAssets }
      if (meta) delete missingAssets[id]
      else missingAssets[id] = true
      return { assets: upsert(s.assets, id, meta), missingAssets }
    })
}))

export function usePage(id: string | null): Page | null | undefined {
  const value = useData((s) => (id ? s.full[id] : null))
  const load = useData((s) => s.loadPage)
  useEffect(() => {
    if (id && useData.getState().full[id] === undefined) void load(id)
  }, [id, load])
  return id ? value : null
}

export function pagePath(pages: PageMeta[], id: string): string {
  const byId = new Map(pages.map((p) => [p.id, p]))
  const chain: string[] = []
  const seen = new Set<string>()
  for (let at: string | null = id; at && !seen.has(at); ) {
    seen.add(at)
    const p = byId.get(at)
    if (!p) break
    chain.unshift(idSegment(p.title) || p.title)
    at = p.parent && byId.has(p.parent) ? p.parent : null
  }
  return chain.join('/') || id
}

export function findPage(pages: PageMeta[], ref: string, accept: (p: PageMeta) => boolean = (p) => p.type !== FOLDER_TYPE): PageMeta | undefined {
  const raw = stripRef(ref)
  const id = toId(raw)
  if (id) {
    const byPath = pages.find((p) => pagePath(pages, p.id) === id && accept(p))
    if (byPath) return byPath
  }
  return pages.find((p) => p.id === raw && accept(p))
}

export function pageRef(pages: PageMeta[], p: PageMeta): string {
  return pagePath(pages, p.id)
}

export function entryLink(kind: string, id: string): string {
  const pages = useData.getState().pages
  return linkFor(kind, pages.some((p) => p.id === id) ? pagePath(pages, id) : id)
}

const lookingUp = new Set<string>()

export function lookUpAsset(id: string, usedBy?: string): void {
  const state = useData.getState()
  if (!id || lookingUp.has(id) || state.missingAssets[id] || state.assets.some((a) => a.id === id)) return
  lookingUp.add(id)
  void engine('data.assets.find', { id })
    .then((a) => {
      if (a) return useData.getState().onAsset(a.id, a)
      useData.setState((s) => ({ missingAssets: { ...s.missingAssets, [id]: true } }))
      reportProblem({ severity: 'warning', area: 'files', message: `${usedBy ?? 'Something'} uses file ${id}, which no longer exists` })
    })
    .catch(noteFailure('files', `Could not look up file ${id}`))
    .finally(() => lookingUp.delete(id))
}

export function useAsset(id: string, usedBy?: string): AssetMeta | null | undefined {
  const meta = useData((s) => s.assets.find((a) => a.id === id))
  const missing = useData((s) => s.missingAssets[id] === true)
  useEffect(() => {
    if (!meta) lookUpAsset(id, usedBy)
  }, [id, meta, usedBy])
  if (meta) return meta
  return missing ? null : undefined
}

export function assetUrl(asset: AssetMeta): string {
  return remoteAssetUrl(asset.id, asset.file) ?? `seven-asset://${asset.id}/${encodeURIComponent(asset.file)}`
}

export function ancestorsOf(id: string, byId: Map<string, PageMeta>): PageMeta[] {
  const out: PageMeta[] = []
  const seen = new Set<string>([id])
  for (let at = byId.get(id)?.parent ?? null; at && !seen.has(at); at = byId.get(at)?.parent ?? null) {
    const p = byId.get(at)
    if (!p) break
    seen.add(at)
    out.unshift(p)
  }
  return out
}

export function rebuildIndex(): Promise<void> {
  return engine('library.reindex').then(() => useData.getState().refresh())
}
