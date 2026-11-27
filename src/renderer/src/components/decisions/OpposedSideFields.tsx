import type { CheckTarget } from '@shared/actions'
import { Effects } from '@shared/game/components'
import { SIDE_LANES, sideEffects, type OpposedSide } from '@shared/opposedCheck'
import { Input, NumberField } from '../ui'
import { SheetSelect } from '../data/sheet/SheetSelect'
import { EffectsEditor } from '../game/effects/EffectsEditor'
import { SkillSelect } from './SkillSelect'

export function OpposedSideFields({ title, side, targets, onChange, editable = false, who = true }: { title: string; side: OpposedSide; targets: CheckTarget[]; onChange: (next: OpposedSide) => void; editable?: boolean; who?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 border border-line/60 bg-ink/[0.02] p-3">
      <span className="text-[12px] font-semibold caps-8 text-dim">{title}</span>
      {!editable && (
        <span className="text-[13.5px] font-semibold text-ink">
          {side.name} <span className="font-normal text-dim">{side.does}</span>
        </span>
      )}
      {who && <SheetSelect value={side.sheet} noneLabel="Someone without a sheet" onChange={(sheet, name) => onChange({ ...side, sheet, name: name ?? (side.sheet ? '' : side.name) })} />}
      {who && editable && !side.sheet && <Input value={side.name} onChange={(e) => onChange({ ...side, name: e.target.value })} placeholder="Who (the gate guard)" />}
      {editable && <Input value={side.does} onChange={(e) => onChange({ ...side, does: e.target.value })} placeholder="Winning means… (spots the lie)" />}
      {editable && <Input value={side.loses ?? ''} onChange={(e) => onChange({ ...side, loses: e.target.value })} placeholder="Losing means… (believes it, still unsure)" />}
      <div className="flex items-center gap-2">
        <SkillSelect targets={targets} value={side.against} onChange={(against) => onChange({ ...side, against })} className="min-w-0 flex-1" />
        {!side.sheet && (
          <label className="flex items-center gap-1.5 text-[12px] text-dim">
            bonus
            <NumberField value={side.bonus} onChange={(v) => onChange({ ...side, bonus: v ?? 0 })} className="w-16" />
          </label>
        )}
      </div>
      {editable && <EffectsEditor host={Effects.type} lanes={SIDE_LANES} aside={false} value={sideEffects(side)} onChange={(effects) => onChange({ ...side, effects, action: null })} />}
    </div>
  )
}
