import { CHANCE, checkNames, findTarget, type CheckTarget } from '@shared/actions'
import { signed } from '@shared/dnd'
import { Select } from '../ui'

export function SkillSelect({ targets = [], value, onChange, chance = false, className }: { targets?: CheckTarget[]; value: string; onChange: (value: string) => void; chance?: boolean; className?: string }) {
  const allChecks = checkNames()
  const list = [
    ...(chance ? [{ value: CHANCE, label: 'Plain chance' }] : []),
    ...allChecks.map((c) => {
      const found = targets.length ? findTarget(targets, c.id) : null
      return {
        value: c.id,
        label: found ? `${c.label} ${signed(found.bonus)}` : c.label
      }
    })
  ]
  const found = findTarget(targets.length ? targets : allChecks.map((c) => ({ ...c, bonus: 0 })), value)
  const current = chance && (!value || value === CHANCE) ? CHANCE : (found?.id ?? value)
  const options = [...(current ? [] : [{ value: '', label: 'Stat, save or skill' }]), ...(current && !list.some((o) => o.value === current) ? [{ value: current, label: current }] : []), ...list]
  return <Select value={current} options={options} onChange={onChange} className={className} />
}
