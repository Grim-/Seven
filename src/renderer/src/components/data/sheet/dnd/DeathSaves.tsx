import type { DndStats } from '@shared/dnd'
import { cn } from '../../../../lib/cn'

function Pips({ label, value, onValue, tone }: { label: string; value: number; onValue: (n: number) => void; tone: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="mr-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-dim">{label}</span>
      {[1, 2, 3].map((n) => (
        <button key={n} onClick={() => onValue(value >= n ? n - 1 : n)} className={cn('h-3 w-3 border', value >= n ? tone : 'border-line/60 hover:border-white/50')} />
      ))}
    </span>
  )
}

export function DeathSaves({ dnd, onChange }: { dnd: DndStats; onChange: (patch: Partial<DndStats>) => void }) {
  return (
    <div className="flex items-center gap-4">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-alert">Death saves</span>
      <Pips label="Saved" value={dnd.deathSaves.ok} tone="border-ok bg-ok" onValue={(ok) => onChange({ deathSaves: { ...dnd.deathSaves, ok } })} />
      <Pips label="Failed" value={dnd.deathSaves.fail} tone="border-alert bg-alert" onValue={(fail) => onChange({ deathSaves: { ...dnd.deathSaves, fail } })} />
    </div>
  )
}
