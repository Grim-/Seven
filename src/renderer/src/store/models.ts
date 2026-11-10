import { create } from 'zustand'
import { MODEL_KINDS, type ModelConfig, type ModelConfigResult, type ModelEntry, type ModelHostState, type ParamDef } from '@shared/types'
import { engine, on } from '../lib/ipc'

interface ModelsState {
  list: ModelEntry[]
  params: ParamDef[]
  host: ModelHostState
  refresh: () => Promise<void>
  scan: (folders: string[]) => Promise<void>
  add: (path: string) => Promise<ModelEntry>
  remove: (id: string) => Promise<void>
  load: (id: string) => Promise<void>
  unload: () => Promise<void>
  setFavourite: (id: string, on: boolean) => Promise<void>
  getConfig: (id: string) => Promise<ModelConfig>
  setConfig: (id: string, patch: ModelConfig) => Promise<ModelConfigResult>
  resetConfig: (id: string) => Promise<ModelConfigResult>
}

export const useModels = create<ModelsState>((set) => ({
  list: [],
  params: [],
  host: { status: 'unloaded', modelId: null, progress: 0, contextSize: null, error: null, restartNeeded: false },
  refresh: async () => {
    const [list, params, host] = await Promise.all([engine('models.list'), engine('models.params'), engine('models.state')])
    set({ list, params, host })
  },
  scan: async (folders) => {
    set({ list: await engine('models.scan', { folders }) })
  },
  add: (path) => engine('models.add', { path }),
  remove: async (id) => {
    await engine('models.remove', { id })
  },
  load: async (id) => {
    set({ host: await engine('models.load', { id }) })
  },
  unload: async () => {
    set({ host: await engine('models.unload') })
  },
  setFavourite: async (id, on) => {
    set({ list: await engine('models.favourite', { id, on }) })
  },
  getConfig: (id) => engine('models.config.get', { id }),
  setConfig: (id, patch) => engine('models.config.set', { id, patch }),
  resetConfig: (id) => engine('models.config.reset', { id })
}))

on('model.state', (host) => useModels.setState({ host }))

export function isRunnable(m: ModelEntry): boolean {
  return m.info ? MODEL_KINDS[m.info.kind].runnable : true
}

export function modelBytes(m: ModelEntry): number {
  return m.info?.sizeBytes ?? m.sizeBytes
}

export function sortModels(list: ModelEntry[], loadedId: string | null): ModelEntry[] {
  const rank = (m: ModelEntry) => (m.id === loadedId ? 0 : m.favourite ? 1 : 2)
  return [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}

export function modelName(list: ModelEntry[], id: string | null): string {
  if (!id) return 'None'
  return list.find((m) => m.id === id)?.name ?? id
}
