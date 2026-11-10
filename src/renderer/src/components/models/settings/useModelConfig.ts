import { useEffect } from 'react'
import type { ModelConfig, ParamDef } from '@shared/types'
import { useAutosavedState, type SaveStatus } from '../../ui'
import { useModels } from '../../../store/models'
import { failed } from '../../../lib/notify'

export interface ModelConfigState {
  config: ModelConfig | null
  status: SaveStatus
  error: string | null
  set: (key: string, value: ParamDef['default']) => void
  replace: (config: ModelConfig) => void
  reset: (def: ParamDef) => void
  resetAll: () => Promise<void>
}

export function useModelConfig(modelId: string): ModelConfigState {
  const { getConfig, setConfig, resetConfig } = useModels()
  const autosave = useAutosavedState<ModelConfig | null>(
    null,
    async (c) => {
      await setConfig(modelId, c!)
    },
    { when: (c) => c !== null }
  )
  useEffect(() => {
    let cancelled = false
    getConfig(modelId)
      .then((c) => !cancelled && autosave.reset(c))
      .catch(failed('Could not read settings'))
    return () => {
      cancelled = true
    }
  }, [modelId, getConfig])
  return {
    config: autosave.value,
    status: autosave.status,
    error: autosave.error,
    set: (key, value) => autosave.set((c) => ({ ...c!, [key]: value })),
    replace: (config) => autosave.set(config),
    reset: (def) => autosave.set((c) => ({ ...c!, [def.key]: def.default })),
    resetAll: async () => {
      await autosave.flush()
      autosave.reset((await resetConfig(modelId)).config)
    }
  }
}
