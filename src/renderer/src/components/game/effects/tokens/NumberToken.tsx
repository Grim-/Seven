import { CountStepper, Slider } from '../../../ui'
import { registerEffectToken, type TokenEditProps, type TokenProps } from './registry'

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

function Text({ spec, value }: TokenProps) {
  return <>{num(value, Number(spec.default) || 0)}</>
}

function Edit({ spec, value, onChange }: TokenEditProps) {
  const n = num(value, Number(spec.default) || 0)
  const ranged = spec.min !== undefined && spec.max !== undefined
  return (
    <div className="flex flex-col gap-3">
      <CountStepper value={n} min={spec.min ?? -999} max={spec.max} onChange={onChange} />
      {ranged && <Slider value={n} min={spec.min ?? 0} max={spec.max ?? 100} onChange={onChange} />}
    </div>
  )
}

registerEffectToken('number', { Text, Edit })
