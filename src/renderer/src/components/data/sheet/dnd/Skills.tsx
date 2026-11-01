import { DND_SKILLS, signed, skillBonus, type DndStat, type DndStats, type Proficiency } from '@shared/dnd'
import { ProfRow } from './ProfRow'

const NEXT: Record<Proficiency, Proficiency> = { 0: 1, 1: 2, 2: 0 }

export function Skills({ dnd, stat, onChange }: { dnd: DndStats; stat: DndStat; onChange: (patch: Partial<DndStats>) => void }) {
  const set = (id: string) => {
    const next = NEXT[dnd.skills[id] ?? 0]
    const skills = { ...dnd.skills }
    if (next) skills[id] = next
    else delete skills[id]
    onChange({ skills })
  }
  return (
    <>
      {DND_SKILLS.filter((s) => s.stat === stat).map((s) => (
        <ProfRow key={s.id} level={dnd.skills[s.id] ?? 0} label={s.name} value={signed(skillBonus(dnd, s.id))} title="Click: proficient, expertise, none" onClick={() => set(s.id)} />
      ))}
    </>
  )
}
