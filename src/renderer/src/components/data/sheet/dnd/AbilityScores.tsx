import { DND_STATS, DND_STAT_NAMES, modifier, saveBonus, signed, type DndStats } from '@shared/dnd'
import { InlineNumber } from '../../../ui'
import { ProfRow } from './ProfRow'
import { Section } from './Section'
import { Skills } from './Skills'

export function AbilityScores({
  dnd,
  onChange
}: {
  dnd: DndStats
  onChange: (patch: Partial<DndStats>) => void
}) {
  return (
    <Section title="Abilities" aside="saves and skills">
      <div className="flex flex-col">
        {DND_STATS.map((k) => (
          <div key={k} className="flex flex-col border-t border-line/25 pt-1.5 first:border-t-0">
            <div className="flex items-baseline gap-2" title={DND_STAT_NAMES[k]}>
              <span className="w-9 font-mono text-[11px] font-bold tracking-[0.1em] text-accent-soft">
                {k.toUpperCase()}
              </span>
              <span className="w-10 font-mono text-[17px] font-bold text-cyan">
                {modifier(dnd.stats[k])}
              </span>
              <InlineNumber
                value={dnd.stats[k]}
                min={1}
                max={30}
                title="Score"
                onSave={(v) => onChange({ stats: { ...dnd.stats, [k]: v } })}
                className="text-[12px] text-faint"
              />
            </div>
            <div className="flex flex-col pb-1 pl-[2.75rem]">
              <ProfRow
                level={dnd.saves[k] ? 1 : 0}
                label="Saving throw"
                value={signed(saveBonus(dnd, k))}
                title="Proficient in this saving throw"
                onClick={() => onChange({ saves: { ...dnd.saves, [k]: !dnd.saves[k] } })}
              />
              <Skills dnd={dnd} stat={k} onChange={onChange} />
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
