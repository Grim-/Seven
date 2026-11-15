import { toId } from './ids'
import { checkSources, type CheckName } from './checkSources'
import { DND_SKILLS, DND_STATS, DND_STAT_NAMES, mod, saveBonus, skillBonus, spellAttack, type DndStats } from './dnd'

type Rated = CheckName & { value: (d: DndStats) => number | null }

const CHECKS: Rated[] = [
  ...DND_STATS.map((s) => ({ id: toId(DND_STAT_NAMES[s]), label: DND_STAT_NAMES[s], group: 'Abilities', value: (d: DndStats) => mod(d.stats[s]) })),
  ...DND_STATS.map((s) => ({ id: `${toId(DND_STAT_NAMES[s])}_save`, label: `${DND_STAT_NAMES[s]} save`, group: 'Saves', value: (d: DndStats) => saveBonus(d, s) })),
  ...DND_SKILLS.map((s) => ({ id: toId(s.name), label: s.name, group: 'Skills', value: (d: DndStats) => skillBonus(d, s.id) })),
  { id: 'spell_attack', label: 'Spell attack', group: 'Attacks', value: spellAttack }
]

const DEFENCES: Rated[] = [
  { id: 'armor_class', label: 'Armor class', group: 'Defences', value: (d) => d.ac },
  ...DND_STATS.map((s) => ({ id: `${toId(DND_STAT_NAMES[s])}_save_defence`, label: `${DND_STAT_NAMES[s]} save (10 + bonus)`, group: 'Defences', value: (d: DndStats) => 10 + saveBonus(d, s) }))
]

const dndOf = (sheet: object): DndStats | null => (sheet as { dnd?: DndStats | null }).dnd ?? null
const name = ({ id, label, group }: Rated): CheckName => ({ id, label, group })

checkSources.add({
  id: 'dnd',
  module: 'dnd',
  name: 'D&D',
  order: 10,
  names: () => CHECKS.map(name),
  defences: () => DEFENCES.map(name),
  checks: (sheet) => {
    const d = dndOf(sheet)
    if (!d) return []
    return CHECKS.flatMap((c) => {
      const bonus = c.value(d)
      return bonus === null ? [] : [{ id: c.id, label: c.label, bonus }]
    })
  },
  defence: (sheet, id) => {
    const d = dndOf(sheet)
    return d ? (DEFENCES.find((c) => c.id === id)?.value(d) ?? null) : null
  }
})
