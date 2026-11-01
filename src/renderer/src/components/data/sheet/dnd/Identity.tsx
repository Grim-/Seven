import { BedDouble, Sparkles } from 'lucide-react'
import { longRest, withClass, withRace, type DndStats } from '@shared/dnd'
import { InlineEdit, InlineNumber, askConfirm } from '../../../ui'
import { cn } from '../../../../lib/cn'
import { useCompendiumList } from '../../../dnd/useCompendiumList'

export function Identity({ dnd, onChange }: { dnd: DndStats; onChange: (patch: Partial<DndStats>) => void }) {
  const races = useCompendiumList('race')
  const classes = useCompendiumList('class')
  const dot = <span className="text-faint">·</span>
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[15px] text-dim">
      <InlineEdit value={dnd.race} placeholder="Race" title="Race" suggestions={races.names} onSave={(race) => { const ref = races.find(race); onChange(ref ? withRace(dnd, ref) : { race }) }} className="font-semibold text-white" />
      {dot}
      <InlineEdit value={dnd.cls} placeholder="Class" title="Class" suggestions={classes.names} onSave={(cls) => { const ref = classes.find(cls); onChange(ref ? withClass(dnd, ref) : { cls }) }} className="font-semibold text-white" />
      <span className="flex items-baseline gap-1">
        <span className="font-mono text-[11px] uppercase text-faint">lvl</span>
        <InlineNumber value={dnd.level} min={1} max={20} title="Level" onSave={(level) => onChange({ level })} className="font-semibold text-white" />
      </span>
      {dot}
      <InlineEdit value={dnd.background} placeholder="Background" title="Background" onSave={(background) => onChange({ background })} />
      {dot}
      <InlineEdit value={dnd.alignment} placeholder="Alignment" title="Alignment" onSave={(alignment) => onChange({ alignment })} />
      {dot}
      <span className="flex items-baseline gap-1">
        <InlineNumber value={dnd.xp} min={0} title="Experience points" onSave={(xp) => onChange({ xp })} className="text-[13px]" />
        <span className="font-mono text-[11px] uppercase text-faint">xp</span>
      </span>
      <span className="ml-auto flex items-center gap-2 self-center">
        <button onClick={() => onChange({ inspiration: !dnd.inspiration })} className={cn('flex h-7 items-center gap-1.5 border px-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em]', dnd.inspiration ? 'border-accent bg-accent/15 text-accent' : 'border-line/50 text-faint hover:text-white')}>
          <Sparkles className="h-3.5 w-3.5" /> Inspiration
        </button>
        <button onClick={() => askConfirm('Take a long rest?', 'HP back to full, temporary HP gone, spell slots back, half your hit dice back, death saves cleared and one level of exhaustion off.', 'Rest', () => onChange(longRest(dnd)))} className="flex h-7 items-center gap-1.5 border border-line/50 px-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-faint hover:text-white">
          <BedDouble className="h-3.5 w-3.5" /> Long rest
        </button>
      </span>
    </div>
  )
}
