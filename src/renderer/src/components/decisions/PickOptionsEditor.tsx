import { Plus, X } from 'lucide-react'
import type { CheckTarget } from '@shared/actions'
import type { PickOption } from '@shared/pickDecision'
import { NO_ROLL } from '@shared/storyRolls'
import { Button, Input } from '../ui'
import { OptionRollFields } from './OptionRollFields'
import { TriggerActionSelect } from '../game/TriggerActionSelect'

export function PickOptionsEditor({ options, onChange, rolls, targets = [] }: { options: PickOption[]; onChange: (next: PickOption[]) => void; rolls: boolean; targets?: CheckTarget[] }) {
  const set = (index: number, next: PickOption | null) => onChange(next ? options.map((o, i) => (i === index ? next : o)) : options.filter((_, i) => i !== index))
  return (
    <div className="flex flex-col gap-2">
      {options.map((o, i) => (
        <div key={i} className="flex flex-col gap-1 border border-line/40 tone-panel-20 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-5 font-ui text-[11px] text-accent">{i + 1}</span>
            <Input value={o.text} onChange={(e) => set(i, { ...o, text: e.target.value })} className="min-w-[14rem] flex-1" />
            {rolls && <OptionRollFields roll={o.roll} targets={targets} onChange={(roll) => set(i, { ...o, roll })} />}
            <Button size="sm" variant="ghost" icon={<X />} title="Remove" onClick={() => set(i, null)} />
          </div>
          <TriggerActionSelect
            value={o.action}
            onChange={(action) => set(i, { ...o, action })}
            placeholder="No in-game trigger action"
            className="h-7 text-[11px]"
          />
        </div>
      ))}
      <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => onChange([...options, { text: '', roll: NO_ROLL, action: null }])} className="self-start">
        Add option
      </Button>
    </div>
  )
}
