import type { ReactNode } from 'react'
import type { ParamDef } from '@shared/types'
import { Fold, SettingCard, SettingRow } from '../../ui'
import { sectionView, type ParamContext } from './paramTree'
import type { ModelConfigState } from './useModelConfig'
import { ParamNodes } from './ParamNodes'

export function SectionPage({ label, defs, ctx, state, lead }: { label: string; defs: ParamDef[]; ctx: ParamContext; state: ModelConfigState; lead?: ReactNode }) {
  const view = sectionView(defs, ctx)
  return (
    <SettingCard title={label}>
      {lead}
      <ParamNodes nodes={view.common} ctx={ctx} state={state} />
      {view.more.length > 0 &&
        (view.common.length ? (
          <Fold label={`More ${label.toLowerCase()} settings`} count={view.more.length}>
            <ParamNodes nodes={view.more} ctx={ctx} state={state} />
          </Fold>
        ) : (
          <ParamNodes nodes={view.more} ctx={ctx} state={state} />
        ))}
      {view.unavailable.length > 0 && (
        <Fold label="Not for this model" count={view.unavailable.length}>
          {view.unavailable.map(({ def, reason }) => (
            <SettingRow key={def.key} label={def.label} hint={reason}>
              <span className="font-ui text-[11px] text-faint">{def.flag?.find((f) => f.startsWith('--')) ?? ''}</span>
            </SettingRow>
          ))}
        </Fold>
      )}
    </SettingCard>
  )
}
