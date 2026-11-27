import { BASE, MIDDLE, checkNames, type CheckTarget } from '@shared/actions'
import { NO_ROLL, type OptionRoll } from '@shared/storyRolls'
import { NumberField, Select } from '../ui'
import { SkillSelect } from './SkillSelect'

const TYPES = [
  { value: 'none', label: 'No roll' },
  { value: 'chance', label: 'Chance' },
  { value: 'check', label: 'Check' }
]

const DEFAULT_CHECK = checkNames()[0]?.id ?? 'strength'

export function OptionRollFields({ roll, targets = [], onChange }: { roll: OptionRoll; targets?: CheckTarget[]; onChange: (next: OptionRoll) => void }) {
  const setType = (type: string) => onChange(type === 'chance' ? { type: 'chance', chance: MIDDLE * 100 } : type === 'check' ? { type: 'check', against: targets[0]?.id ?? DEFAULT_CHECK, dc: BASE } : NO_ROLL)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={roll.type} options={TYPES} onChange={setType} className="w-28" />
      {roll.type === 'chance' && (
        <>
          <NumberField value={roll.chance} min={0} max={100} onChange={(v) => onChange({ ...roll, chance: v ?? 0 })} className="w-20" />
          <span className="font-ui text-[11px] text-dim">%</span>
        </>
      )}
      {roll.type === 'check' && (
        <>
          <SkillSelect targets={targets} value={roll.against} onChange={(against) => onChange({ ...roll, against })} className="w-52" />
          <span className="font-ui text-[11px] text-dim">DC</span>
          <NumberField value={roll.dc} onChange={(v) => onChange({ ...roll, dc: v ?? 0 })} className="w-16" />
        </>
      )}
    </div>
  )
}
