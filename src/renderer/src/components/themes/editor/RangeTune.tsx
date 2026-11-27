import type { Bounds } from '@shared/themeLook'
import { SliderNumber, TunableRow } from '../../ui'

export function RangeTune({ label, hint, value, fallback, bounds, step, onChange }: { label: string; hint?: string; value: number | undefined; fallback: number | undefined; bounds: Bounds; step: number; onChange: (v: number | undefined) => void }) {
  return (
    <TunableRow label={label} hint={hint} changed={value !== undefined} onReset={() => onChange(undefined)}>
      <SliderNumber value={value ?? fallback ?? bounds.min} min={bounds.min} max={bounds.max} step={step} onChange={onChange} />
    </TunableRow>
  )
}
