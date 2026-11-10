import type { CheckTarget } from '@shared/actions'
import type { OpposedSide } from '@shared/opposedCheck'
import { Input, NumberField } from '../ui'
import { SheetSelect } from '../data/sheet/SheetSelect'
import { SkillSelect } from './SkillSelect'
import { TriggerActionSelect } from '../game/TriggerActionSelect'

export function OpposedSideFields({ title, side, targets, onChange, editable = false }: { title: string; side: OpposedSide; targets: CheckTarget[]; onChange: (next: OpposedSide) => void; editable?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 border border-line/60 bg-white/[0.02] p-3">
      <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-dim">{title}</span>
      {!editable && (
        <span className="text-[13.5px] font-semibold text-white">
          {side.name} <span className="font-normal text-dim">{side.does}</span>
        </span>
      )}
      <SheetSelect value={side.sheet} noneLabel="Someone without a sheet" onChange={(sheet, name) => onChange({ ...side, sheet, name: name ?? (side.sheet ? '' : side.name) })} />
      {editable && !side.sheet && <Input value={side.name} onChange={(e) => onChange({ ...side, name: e.target.value })} placeholder="Who (the gate guard)" />}
      {editable && <Input value={side.does} onChange={(e) => onChange({ ...side, does: e.target.value })} placeholder="Winning means… (spots the lie)" />}
      {editable && (
        <TriggerActionSelect
          value={side.action}
          onChange={(action) => onChange({ ...side, action })}
          placeholder="No in-game trigger on win"
          className="h-7 text-[11px]"
        />
      )}
      <div className="flex items-center gap-2">
        <SkillSelect targets={targets} value={side.against} onChange={(against) => onChange({ ...side, against })} className="min-w-0 flex-1" />
        {!side.sheet && (
          <label className="flex items-center gap-1.5 text-[12px] text-dim">
            bonus
            <NumberField value={side.bonus} onChange={(v) => onChange({ ...side, bonus: v ?? 0 })} className="w-16" />
          </label>
        )}
      </div>
    </div>
  )
}
