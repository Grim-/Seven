import { CHANCE, checkNames, findTarget, type CheckTarget } from '@shared/actions'
import { signed } from '@shared/text'
import { BrowsePick, type BrowseOption } from '../ui/BrowsePick'

export function SkillSelect({ targets = [], value, onChange, chance = false, className }: { targets?: CheckTarget[]; value: string; onChange: (value: string) => void; chance?: boolean; className?: string }) {
  const options: BrowseOption[] = [
    ...(chance ? [{ value: CHANCE, label: 'Plain chance', group: 'Chance' }] : []),
    ...checkNames().map((c) => {
      const found = targets.length ? findTarget(targets, c.id) : null
      return { value: c.id, label: found ? `${c.label} ${signed(found.bonus)}` : c.label, group: c.group }
    })
  ]
  const current = chance && (!value || value === CHANCE) ? CHANCE : (findTarget(checkNames().map((c) => ({ ...c, bonus: 0 })), value)?.id ?? value)
  return <BrowsePick value={current || null} options={options} placeholder="Stat, save or skill" onChange={(next) => onChange(next ?? (chance ? CHANCE : ''))} className={className} />
}
