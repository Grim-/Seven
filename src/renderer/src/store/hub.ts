import { create } from 'zustand'
import type { HubFamily, HubFile, HubModel, ModelInfo } from '@shared/types'
import { engine } from '../lib/ipc'
import { errorText } from '../lib/format'

type Loaded<T> = { value: T; error: null } | { value: null; error: string }

interface HubState {
  query: string
  family: HubFamily
  results: HubModel[] | null
  searching: boolean
  error: string | null
  files: Record<string, Loaded<HubFile[]>>
  headers: Record<string, Loaded<ModelInfo>>
  facts: Record<string, Loaded<ModelInfo | null>>
  search: (query: string, family?: HubFamily) => Promise<void>
  loadFiles: (repo: string, family?: HubFamily) => Promise<void>
  loadHeader: (repo: string, file: string) => Promise<void>
  resolveFacts: (models: HubModel[]) => void
}

export const headerKey = (repo: string, file: string) => `${repo}/${file}`
export const filesKey = (repo: string, family: HubFamily) => `${family}:${repo}`

const FACT_WORKERS = 3
const HEADER_WORKERS = 3
const queue: HubModel[] = []
const asked = new Set<string>()
let working = 0

interface HeaderJob {
  repo: string
  file: string
  key: string
}
const headerQueue: HeaderJob[] = []
const headerQueued = new Set<string>()
let headerWorkers = 0

export const useHub = create<HubState>((set, get) => {
  const work = async (): Promise<void> => {
    const next = queue.shift()
    if (!next) return
    working++
    try {
      const value = await engine('hub.repoFacts', { repo: next.id, updatedAt: next.updatedAt })
      set((s) => ({ facts: { ...s.facts, [next.id]: { value, error: null } } }))
    } catch (err) {
      set((s) => ({ facts: { ...s.facts, [next.id]: { value: null, error: errorText(err) } } }))
    } finally {
      working--
      void work()
    }
  }
  const workHeader = async (): Promise<void> => {
    const next = headerQueue.shift()
    if (!next) return
    headerWorkers++
    try {
      const value = await engine('hub.fileInfo', { repo: next.repo, file: next.file })
      set((s) => ({ headers: { ...s.headers, [next.key]: { value, error: null } } }))
    } catch (err) {
      set((s) => ({ headers: { ...s.headers, [next.key]: { value: null, error: errorText(err) } } }))
    } finally {
      headerQueued.delete(next.key)
      headerWorkers--
      void workHeader()
    }
  }
  return {
    query: '',
    family: 'gguf',
    results: null,
    searching: false,
    error: null,
    files: {},
    headers: {},
    facts: {},
    search: async (query, family) => {
      const targetFamily = family ?? get().family
      const switched = targetFamily !== get().family
      set({ query, family: targetFamily, searching: true, error: null, ...(switched ? { results: null } : {}) })
      try {
        const results = await engine('hub.search', { query, family: targetFamily })
        if (get().query === query && get().family === targetFamily) set({ results, searching: false })
      } catch (err) {
        if (get().query === query && get().family === targetFamily) set({ error: errorText(err), searching: false })
      }
    },
    loadFiles: async (repo, family) => {
      const targetFamily = family ?? get().family
      const key = filesKey(repo, targetFamily)
      try {
        const value = await engine('hub.files', { repo, family: targetFamily })
        set((s) => ({ files: { ...s.files, [key]: { value, error: null } } }))
      } catch (err) {
        set((s) => ({ files: { ...s.files, [key]: { value: null, error: errorText(err) } } }))
      }
    },
    loadHeader: async (repo, file) => {
      const key = headerKey(repo, file)
      if (get().headers[key] || headerQueued.has(key)) return
      headerQueued.add(key)
      headerQueue.push({ repo, file, key })
      while (headerWorkers < HEADER_WORKERS && headerQueue.length) void workHeader()
    },
    resolveFacts: (models) => {
      for (const m of models) {
        if (m.family === 'diffusion' || asked.has(m.id)) continue
        asked.add(m.id)
        queue.push(m)
      }
      while (working < FACT_WORKERS && queue.length) void work()
    }
  }
})
