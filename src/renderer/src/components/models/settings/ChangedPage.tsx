import { RotateCcw } from 'lucide-react'
import type { ParamDef } from '@shared/types'
import { Button, EmptyState, SettingCard } from '../../ui'
import { isChanged, unavailableReason, type ParamContext } from './paramTree'
import type { ModelConfigState } from './useModelConfig'
import { MODEL_SECTIONS } from './sections'
import { ParamRow } from './ParamRow'

export function changedParams(params: ParamDef[], ctx: ParamContext): ParamDef[] {
  return params.filter((p) => isChanged(p, ctx.own))
}

export function ChangedPage({ params, ctx, state }: { params: ParamDef[]; ctx: ParamContext; state: ModelConfigState }) {
  const changed = changedParams(params, ctx)
  if (!changed.length) return <EmptyState title="All defaults">Every setting of this model is at its default. Changes you make show up here.</EmptyState>
  return MODEL_SECTIONS.map((section) => {
    const defs = changed.filter((p) => p.section === section.id)
    if (!defs.length) return null
    return (
      <SettingCard
        key={section.id}
        title={section.label}
        count={defs.length}
        actions={
          section.id === changed[0].section ? (
            <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => void state.resetAll()}>
              Reset all
            </Button>
          ) : undefined
        }
      >
        {defs.map((def) => (
          <ParamRow key={def.key} def={def} ctx={ctx} reason={unavailableReason(def, ctx)} onChange={state.set} onReset={state.reset} />
        ))}
      </SettingCard>
    )
  })
}
