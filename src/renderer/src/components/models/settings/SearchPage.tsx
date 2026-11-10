import type { ParamDef } from '@shared/types'
import { paramBlock } from '@shared/modelParams'
import { EmptyState, SettingCard } from '../../ui'
import { paramMatches, type ParamContext } from './paramTree'
import type { ModelConfigState } from './useModelConfig'
import { MODEL_SECTIONS } from './sections'
import { ParamRow } from './ParamRow'

export function SearchPage({ params, query, ctx, state }: { params: ParamDef[]; query: string; ctx: ParamContext; state: ModelConfigState }) {
  const found = params.filter((p) => paramMatches(p, query))
  if (!found.length) return <EmptyState title="No setting matches">Nothing is called or flagged "{query.trim()}". Try part of the name or a llama.cpp flag such as --ctx.</EmptyState>
  return MODEL_SECTIONS.map((section) => {
    const defs = found.filter((p) => p.section === section.id)
    if (!defs.length) return null
    return (
      <SettingCard key={section.id} title={section.label} count={defs.length}>
        {defs.map((def) => (
          <ParamRow key={def.key} def={def} ctx={ctx} reason={paramBlock(def, ctx.config, ctx.traits, ctx.byKey, ctx.build)} onChange={state.set} onReset={state.reset} />
        ))}
      </SettingCard>
    )
  })
}
