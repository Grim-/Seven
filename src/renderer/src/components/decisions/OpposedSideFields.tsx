import type { CheckTarget } from '@shared/actions'
import type { OpposedSide } from '@shared/opposedCheck'
import { NumberField } from '../ui'
import { SheetSelect } from '../data/sheet/SheetSelect'
import { SkillSelect } from './SkillSelect'

export function OpposedSideFields({ title, side, targets, onChange }: { title: string; side: OpposedSide; targets: CheckTarget[]; onChange: (next: OpposedSide) => void }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 border border-line/60 p-2.5">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-dim">{title}</span>
      <span className="text-[13.5px] font-semibold text-white">
        {side.name} <span className="font-normal text-dim">{side.does}</span>
      </span>
      <SheetSelect value={side.sheet} onChange={(sheet) => onChange({ ...side, sheet })} />
      <div className="flex items-center gap-2">
        <SkillSelect targets={targets} value={side.against} onChange={(against) => onChange({ ...side, against })} className="min-w-0 flex-1" />
        {!side.sheet && <NumberField value={side.bonus} onChange={(v) => onChange({ ...side, bonus: v ?? 0 })} className="w-16" />}
      </div>
    </div>
  )
}
