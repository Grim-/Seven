import { SaveState, SettingCard } from '../../ui'
import { useModels } from '../../../store/models'
import type { ParamContext } from './paramTree'
import { REMOTE_KEYS } from './sections'
import { useModelConfig } from './useModelConfig'
import { ParamRow } from './ParamRow'

const CONTEXT_HINT = "The model's context window in tokens, from the provider. Seven uses it to measure the chat and decide when to summarise."

export function RemoteParams({ modelId }: { modelId: string }) {
  const params = useModels((s) => s.params)
  const state = useModelConfig(modelId)
  if (!state.config) return null
  const ctx: ParamContext = { config: state.config, own: state.config, packs: {}, traits: {}, byKey: new Map(params.map((p) => [p.key, p])), build: null }
  return (
    <SettingCard title="Settings" actions={<SaveState status={state.status} error={state.error} />}>
      {params
        .filter((p) => REMOTE_KEYS.has(p.key))
        .map((def) => (
          <ParamRow key={def.key} def={def} ctx={ctx} hint={def.key === 'contextSize' ? CONTEXT_HINT : undefined} onChange={state.set} onReset={state.reset} />
        ))}
    </SettingCard>
  )
}
