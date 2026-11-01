import { create } from 'zustand'
import type { HubFile, HubModel, ModelInfo } from '@shared/types'
import { engine } from '../lib/ipc'
import { errorText } from '../lib/format'

type Loaded<T> = { value: T; error: null } | { value: null; error: string }

interface HubState {
  query: string
  results: HubModel[] | null
  searching: boolean
  error: string | null
  files: Record<string, Loaded<HubFile[]>>
  headers: Record<string, Loaded<ModelInfo>>
  facts: Record<string, Loaded<ModelInfo | null>>
  search: (query: string) => Promise<void>
  loadFiles: (repo: string) => Promise<void>
  loadHeader: (repo: string, file: string) => Promise<void>
  resolveFacts: (models: HubModel[]) => void
}

export const headerKey = (repo: string, file: string) => `${repo}/${file}`

const FACT_WORKERS = 3
const queue: HubModel[] = []
const asked = new Set<string>()
let working = 0

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
  return {
    query: '',
    results: null,
    searching: false,
    error: null,
    files: {},
    headers: {},
    facts: {},
    search: async (query) => {
      set({ query, searching: true, error: null })
      try {
        const results = await engine('hub.search', { query })
        if (get().query === query) set({ results, searching: false })
      } catch (err) {
        if (get().query === query) set({ error: errorText(err), searching: false })
      }
    },
    loadFiles: async (repo) => {
      try {
        const value = await engine('hub.files', { repo })
        set((s) => ({ files: { ...s.files, [repo]: { value, error: null } } }))
      } catch (err) {
        set((s) => ({ files: { ...s.files, [repo]: { value: null, error: errorText(err) } } }))
      }
    },
    loadHeader: async (repo, file) => {
      const key = headerKey(repo, file)
      if (get().headers[key]) return
      try {
        const value = await engine('hub.fileInfo', { repo, file })
        set((s) => ({ headers: { ...s.headers, [key]: { value, error: null } } }))
      } catch (err) {
        set((s) => ({ headers: { ...s.headers, [key]: { value: null, error: errorText(err) } } }))
      }
    },
    resolveFacts: (models) => {
      for (const m of models) {
        if (asked.has(m.id)) continue
        asked.add(m.id)
        queue.push(m)
      }
      while (working < FACT_WORKERS && queue.length) void work()
    }
  }
})
