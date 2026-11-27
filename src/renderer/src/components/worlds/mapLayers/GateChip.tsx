import { Flag } from 'lucide-react'
import type { ConditionGating } from '@shared/maps'
import { Field, Popover } from '../../ui'
import { FlagSelect } from '../../game/FlagSelect'
import { cn } from '../../../lib/cn'

export function gateText(g: ConditionGating): string {
  return [g.needsFlag ? `needs ${g.needsFlag}` : '', g.hiddenIfFlag ? `off if ${g.hiddenIfFlag}` : ''].filter(Boolean).join(' · ')
}

export function GateChip({ world, gating, onChange }: { world: string; gating: ConditionGating; onChange: (next: ConditionGating) => void }) {
  const text = gateText(gating)
  const set = (key: keyof ConditionGating) => (flag: string | undefined) => {
    const { [key]: _old, ...rest } = gating
    onChange(flag ? { ...rest, [key]: flag } : rest)
  }
  return (
    <Popover
      title="Flag that turns this layer on or off"
      trigger={
        <span className={cn('flex max-w-[150px] items-center gap-1 border px-1.5 py-0.5 text-[10px]', text ? 'border-accent/50 text-accent' : 'border-line/50 text-faint hover:text-ink')}>
          <Flag className="h-3 w-3 shrink-0" />
          <span className="truncate">{text || 'Always on'}</span>
        </span>
      }
      className="w-72 p-3"
    >
      <div className="flex flex-col gap-2">
        <Field label="On only while flag is set">
          <FlagSelect world={world} value={gating.needsFlag ?? ''} onChange={set('needsFlag')} />
        </Field>
        <Field label="Off while flag is set">
          <FlagSelect world={world} value={gating.hiddenIfFlag ?? ''} onChange={set('hiddenIfFlag')} />
        </Field>
      </div>
    </Popover>
  )
}
