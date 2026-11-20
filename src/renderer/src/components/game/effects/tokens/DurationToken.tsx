import { DurationInput } from '../../DurationInput'
import { durationText, durationUnits } from '../../duration'
import { useGameCatalog } from '../../useGameCatalog'
import { registerEffectToken, type TokenEditProps, type TokenProps } from './registry'

const secondsOf = (value: unknown, fallback: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : Number(fallback) || 0)

function Text({ spec, value }: TokenProps) {
  return <>{durationText(secondsOf(value, spec.default), durationUnits(useGameCatalog()))}</>
}

function Edit({ spec, value, onChange }: TokenEditProps) {
  return <DurationInput value={secondsOf(value, spec.default)} onChange={onChange} />
}

registerEffectToken('duration', { Text, Edit })
