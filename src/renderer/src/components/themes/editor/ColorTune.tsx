import { HexColor, TunableRow } from '../../ui'

export function ColorTune({ label, hint, value, fallback, alpha = false, onChange }: { label: string; hint?: string; value: string | null; fallback?: string; alpha?: boolean; onChange: (v: string | null) => void }) {
  return (
    <TunableRow label={label} hint={hint} changed={value !== null} onReset={() => onChange(null)}>
      <HexColor value={value} placeholder={fallback} alpha={alpha} onChange={onChange} />
    </TunableRow>
  )
}
