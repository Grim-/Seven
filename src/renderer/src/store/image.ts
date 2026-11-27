import { create } from 'zustand'
import type {
  GeneratedImageResult,
  ImageEditRequest,
  ImageGenerateRequest,
  ImageHistoryEntry,
  ImageHostState,
  ImageLoraSelection,
  ImageModelInstalledEvent
} from '@shared/types'
import { engine, on } from '../lib/ipc'
import { errorText } from '../lib/format'

interface ImageStoreState {
  host: ImageHostState
  history: ImageHistoryEntry[]
  defaultModelId: string | null
  generating: boolean
  error: string | null
  lastResult: GeneratedImageResult | null
  selectedAssetId: string | null
  activeLoras: ImageLoraSelection[]
  pendingSetup: ImageModelInstalledEvent | null
  refresh: () => Promise<void>
  refreshDefaultModel: () => Promise<void>
  setDefaultModel: (id: string | null) => Promise<void>
  refreshHistory: () => Promise<void>
  removeHistory: (id: string, deleteAsset?: boolean) => Promise<void>
  clearHistory: () => Promise<void>
  load: (id: string) => Promise<void>
  unload: () => Promise<void>
  cancel: () => Promise<boolean>
  generate: (req: ImageGenerateRequest) => Promise<GeneratedImageResult>
  edit: (req: ImageEditRequest) => Promise<GeneratedImageResult>
  setSelectedAssetId: (id: string | null) => void
  setError: (error: string | null) => void
  addLora: (id: string, weight?: number) => void
  setLoraWeight: (id: string, weight: number) => void
  removeLora: (id: string) => void
  clearLoras: () => void
  openSetup: (modelId: string, modelName?: string, missingSlots?: string[]) => void
  closeSetup: () => void
}

export const useImageHost = create<ImageStoreState>((set) => ({
  host: {
    status: 'unloaded',
    residency: 'ephemeral',
    modelId: null,
    modelName: null,
    pid: null,
    startedAt: null,
    version: null,
    args: [],
    busyCount: 0,
    progress: null,
    error: null,
    log: []
  },
  history: [],
  defaultModelId: null,
  generating: false,
  error: null,
  lastResult: null,
  selectedAssetId: null,
  activeLoras: [],
  pendingSetup: null,
  refresh: async () => {
    const [host, defaultModelId] = await Promise.all([
      engine('image.status'),
      engine('models.defaultImage.get')
    ])
    set({ host, defaultModelId })
  },
  refreshDefaultModel: async () => {
    set({ defaultModelId: await engine('models.defaultImage.get') })
  },
  setDefaultModel: async (id) => {
    const saved = await engine('models.defaultImage.set', { id })
    set({ defaultModelId: saved })
  },
  refreshHistory: async () => {
    set({ history: await engine('image.history.list') })
  },
  removeHistory: async (id, deleteAsset) => {
    set({ history: await engine('image.history.remove', { id, deleteAsset }) })
  },
  clearHistory: async () => {
    set({ history: await engine('image.history.clear'), lastResult: null, selectedAssetId: null })
  },
  load: async (id) => {
    set({ host: await engine('image.load', { id }) })
  },
  unload: async () => {
    set({ host: await engine('image.unload') })
  },
  cancel: () => engine('image.cancel'),
  generate: async (req) => {
    set({ generating: true, error: null, selectedAssetId: null, lastResult: null })
    try {
      const res = await engine('image.generate', req)
      set({ lastResult: res, selectedAssetId: res.asset.id, generating: false, error: null })
      return res
    } catch (err) {
      set({ generating: false, error: errorText(err) })
      throw err
    }
  },
  edit: async (req) => {
    set({ generating: true, error: null, selectedAssetId: null, lastResult: null })
    try {
      const res = await engine('image.edit', req)
      set({ lastResult: res, selectedAssetId: res.asset.id, generating: false, error: null })
      return res
    } catch (err) {
      set({ generating: false, error: errorText(err) })
      throw err
    }
  },
  setSelectedAssetId: (selectedAssetId) => set({ selectedAssetId }),
  setError: (error) => set({ error }),
  addLora: (id, weight = 0.8) =>
    set((s) => {
      if (s.activeLoras.some((l) => l.id === id)) return s
      return { activeLoras: [...s.activeLoras, { id, weight }] }
    }),
  setLoraWeight: (id, weight) =>
    set((s) => ({
      activeLoras: s.activeLoras.map((l) => (l.id === id ? { ...l, weight } : l))
    })),
  removeLora: (id) =>
    set((s) => ({
      activeLoras: s.activeLoras.filter((l) => l.id !== id)
    })),
  clearLoras: () => set({ activeLoras: [] }),
  openSetup: (modelId, modelName = '', missingSlots = []) =>
    set({ pendingSetup: { modelId, modelName, missingSlots } }),
  closeSetup: () => set({ pendingSetup: null })
}))

on('image.changed', (host) =>
  useImageHost.setState((s) => ({
    host,
    generating: host.status === 'loading' || host.status === 'generating' || host.busyCount > 0 ? true : s.generating && host.status !== 'error' && host.status !== 'ready' && host.status !== 'unloaded'
  }))
)
on('image.history.changed', (history) => useImageHost.setState({ history }))
on('image.modelInstalled', (ev) => useImageHost.setState({ pendingSetup: ev }))
