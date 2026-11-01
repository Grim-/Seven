import { ordinal, proficiencyBonus, signed } from '@shared/dnd'
import { openEntry } from '../../lib/library'
import { useCompendiumList } from './useCompendiumList'

export function LevelTable({ rows, owner }: { rows: { level: number; items: string[] }[]; owner: string }) {
  const features = useCompendiumList('feature')
  const find = (name: string) => features.refs.find((r) => r.name.toLowerCase() === name.toLowerCase() && String(r.facts.from ?? '').toLowerCase().includes(owner.toLowerCase())) ?? features.find(name)
  return (
    <div className="border border-line/40 bg-black/40">
      <div className="grid grid-cols-[4rem_3.5rem_minmax(0,1fr)] gap-3 border-b border-line/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
        <span>Level</span>
        <span>Prof</span>
        <span>You gain</span>
      </div>
      {rows.map((r) => (
        <div key={r.level} className="grid grid-cols-[4rem_3.5rem_minmax(0,1fr)] items-baseline gap-3 border-b border-line/20 px-3 py-1.5 last:border-b-0 hover:bg-white/[0.02]">
          <span className="font-mono text-[13px] font-bold text-accent-soft">{ordinal(r.level)}</span>
          <span className="font-mono text-[12.5px] text-cyan">{signed(proficiencyBonus(r.level))}</span>
          <span className="flex flex-wrap gap-1.5">
            {r.items.map((item, i) => {
              const ref = find(item)
              return ref ? (
                <button key={i} onClick={() => openEntry('feature', ref.id)} className="border border-line/50 px-2 py-0.5 text-[12.5px] text-white hover:border-accent/60 hover:text-accent">
                  {item}
                </button>
              ) : (
                <span key={i} className="border border-line/30 px-2 py-0.5 text-[12.5px] text-dim">
                  {item}
                </span>
              )
            })}
          </span>
        </div>
      ))}
    </div>
  )
}
