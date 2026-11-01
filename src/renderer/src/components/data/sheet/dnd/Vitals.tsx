import { hitDiceCount, modifier, passivePerception, proficiencyBonus, signed, type DndStats } from '@shared/dnd'
import { InlineEdit, InlineNumber } from '../../../ui'
import { HpControl } from './HpControl'
import { StatInput } from './StatInput'

export function Vitals({ dnd, onChange }: { dnd: DndStats; onChange: (patch: Partial<DndStats>) => void }) {
  const dice = hitDiceCount(dnd)
  return (
    <div className="grid grid-cols-2 border border-line/50 bg-black/50 sm:grid-cols-3 xl:grid-cols-[minmax(19rem,2.4fr)_repeat(6,minmax(0,1fr))]">
      <div className="col-span-2 sm:col-span-3 xl:col-span-1">
        <HpControl dnd={dnd} onChange={onChange} />
      </div>
      <StatInput label="AC" value={dnd.ac} min={0} onValue={(ac) => onChange({ ac })} />
      <StatInput label="Initiative" value={modifier(dnd.stats.dex)} />
      <StatInput label="Speed" value={dnd.speed} min={0} onValue={(speed) => onChange({ speed })} sub="ft" />
      <StatInput label="Prof" value={signed(proficiencyBonus(dnd.level))} />
      <StatInput label="Passive Perc" value={passivePerception(dnd)} />
      <StatInput label="Hit dice" sub={<InlineEdit value={dnd.hitDice.total} placeholder="1d8" title="Hit dice, e.g. 5d8" onSave={(total) => onChange({ hitDice: { ...dnd.hitDice, total } })} />}>
        <InlineNumber value={dice - dnd.hitDice.used} min={0} max={dice} title="Hit dice left" onSave={(left) => onChange({ hitDice: { ...dnd.hitDice, used: dice - left } })} />
      </StatInput>
    </div>
  )
}
