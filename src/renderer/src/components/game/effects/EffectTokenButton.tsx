import type { ParamSpec } from '@shared/game/core/params'
import { cn } from '../../../lib/cn'
import { Eyebrow, Popover } from '../../ui'
import { paramLabel } from '../params'
import { effectToken, PARAM_TOKEN } from './tokens'

const isEmpty = (v: unknown): boolean => v === '' || v === null || v === undefined

export function EffectTokenButton({ name, spec, value, onChange }: { name: string; spec: ParamSpec; value: unknown; onChange: (value: unknown) => void }) {
  const token = effectToken(spec.kind) ?? PARAM_TOKEN
  const empty = isEmpty(value)
  return (
    <Popover
      align="start"
      title={spec.description}
      rootClassName="mx-0.5 inline-flex align-middle"
      className={cn('notch-sm gap-3 p-3', token.wide ? 'w-[min(26rem,94vw)]' : 'w-[min(18rem,94vw)]')}
      triggerClassName={cn(
        'inline-flex h-[26px] items-center gap-1.5 border px-2 font-mono text-[13.5px] transition-colors',
        empty ? 'border-dashed border-line text-dim hover:border-dim hover:text-white' : 'border-[color-mix(in_srgb,var(--tone)_45%,transparent)] bg-[color-mix(in_srgb,var(--tone)_10%,transparent)] font-semibold text-white hover:border-[var(--tone)] hover:bg-[color-mix(in_srgb,var(--tone)_20%,transparent)]'
      )}
      trigger={empty ? paramLabel(name, spec) : <token.Text spec={spec} value={value} />}
    >
      {(close) => (
        <>
          <Eyebrow>{paramLabel(name, spec)}</Eyebrow>
          <token.Edit spec={spec} value={value} onChange={onChange} close={close} />
        </>
      )}
    </Popover>
  )
}

export function EffectTokenText({ name, spec, value, chip = false }: { name: string; spec: ParamSpec; value: unknown; chip?: boolean }) {
  const token = effectToken(spec.kind) ?? PARAM_TOKEN
  return (
    <span className={cn('font-semibold text-white', chip && 'mx-0.5 inline-flex items-center border border-[color-mix(in_srgb,var(--tone)_45%,transparent)] bg-[color-mix(in_srgb,var(--tone)_10%,transparent)] px-1 font-mono text-[0.92em]')}>
      {isEmpty(value) ? `[${paramLabel(name, spec)}]` : <token.Text spec={spec} value={value} />}
    </span>
  )
}
