import type { Named } from '@shared/themeLook'
import { Segmented, TunableRow } from '../../ui'

export function ChoiceTune<T extends string>({ label, hint, value, fallback, options, onChange }: { label: string; hint?: string; value: T | undefined; fallback?: T; options: Named<T>[]; onChange: (v: T | undefined) => void }) {
  return (
    <TunableRow label={label} hint={hint} changed={value !== undefined} onReset={() => onChange(undefined)}>
      <Segmented<T> value={value ?? fallback ?? ('' as T)} options={options.map((o) => ({ value: o.id, label: o.label }))} onChange={onChange} />
    </TunableRow>
  )
}
