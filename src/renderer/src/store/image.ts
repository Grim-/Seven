import { create } from 'zustand'
import type { GeneratedImageResult, ImageEditRequest, ImageGenerateRequest, ImageHistoryEntry, ImageHostState } from '@shared/types'
import { engine, on } from '../lib/ipc'

interface ImageStoreState {
  host: ImageHostState
  history: ImageHistoryEntry[]
  refresh: () => Promise<void>
  refreshHistory: () => Promise<void>
  removeHistory: (id: string) => Promise<void>
  clearHistory: () => Promise<void>
  load: (id: string) => Promise<void>
  unload: () => Promise<void>
  cancel: () => Promise<boolean>
  generate: (req: ImageGenerateRequest) => Promise<GeneratedImageResult>
  edit: (req: ImageEditRequest) => Promise<GeneratedImageResult>
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
  refresh: async () => {
    set({ host: await engine('image.status') })
  },
  refreshHistory: async () => {
    set({ history: await engine('image.history.list') })
  },
  removeHistory: async (id) => {
    set({ history: await engine('image.history.remove', { id }) })
  },
  clearHistory: async () => {
    set({ history: await engine('image.history.clear') })
  },
  load: async (id) => {
    set({ host: await engine('image.load', { id }) })
  },
  unload: async () => {
    set({ host: await engine('image.unload') })
  },
  cancel: () => engine('image.cancel'),
  generate: (req) => engine('image.generate', req),
  edit: (req) => engine('image.edit', req)
}))

on('image.changed', (host) => useImageHost.setState({ host }))
on('image.history.changed', (history) => useImageHost.setState({ history }))
