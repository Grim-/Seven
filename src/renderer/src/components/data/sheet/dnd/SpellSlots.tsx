import { ordinal, type DndStats } from '@shared/dnd'
import { InlineNumber } from '../../../ui'
import { cn } from '../../../../lib/cn'

export function SpellSlots({ dnd, onChange }: { dnd: DndStats; onChange: (patch: Partial<DndStats>) => void }) {
  const set = (i: number, patch: Partial<DndStats['slots'][number]>) => onChange({ slots: dnd.slots.map((s, j) => (j === i ? { ...s, ...patch, used: Math.max(0, Math.min(patch.max ?? s.max, patch.used ?? s.used)) } : s)) })
  const next = dnd.slots.findIndex((s) => !s.max)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-ui text-[11px]">
      {dnd.slots.map((s, i) =>
        s.max > 0 ? (
          <span key={i} className="flex items-center gap-1">
            <span className="mr-0.5 text-accent-soft">{ordinal(i + 1)}</span>
            {Array.from({ length: s.max }, (_, n) => {
              const left = n < s.max - s.used
              return <button key={n} title={left ? 'Use a slot' : 'Get a slot back'} onClick={() => set(i, { used: s.used + (left ? 1 : -1) })} className={cn('h-2.5 w-2.5 border', left ? 'border-accent bg-accent' : 'border-line hover:border-ink/50')} />
            })}
            <span className="ml-0.5 text-faint">/</span>
            <InlineNumber value={s.max} min={0} max={9} title="Slots at this level" onSave={(max) => set(i, { max })} className="text-faint" />
          </span>
        ) : null
      )}
      {next >= 0 && (
        <button onClick={() => set(next, { max: 1 })} className="text-faint hover:text-accent">
          + {ordinal(next + 1)} level slots
        </button>
      )}
    </div>
  )
}
