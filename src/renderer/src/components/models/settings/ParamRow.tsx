import type { ReactNode } from 'react'
import type { ParamDef } from '@shared/types'
import { TunableRow } from '../../ui'
import { ParamInput } from './ParamInput'
import { isChanged, valueOf, type ParamContext } from './paramTree'

export function ParamRow({ def, ctx, reason, hint, onChange, onReset, children }: { def: ParamDef; ctx: ParamContext; reason?: string | null; hint?: string; onChange: (key: string, value: ParamDef['default']) => void; onReset: (def: ParamDef) => void; children?: ReactNode }) {
  const pack = ctx.packs[def.key]
  return (
    <TunableRow label={def.label} hint={reason ?? hint ?? def.hint} wide={def.type === 'files'} changed={isChanged(def, ctx.own)} from={pack ? `pack: ${pack.title}` : undefined} onReset={() => onReset(def)} disabled={Boolean(reason)} nested={children}>
      <ParamInput def={def} value={valueOf(def, ctx.config)} onChange={(v) => onChange(def.key, v)} />
    </TunableRow>
  )
}
