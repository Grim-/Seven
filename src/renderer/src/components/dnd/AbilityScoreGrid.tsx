import { DND_STATS, modifier, type DndStat } from '@shared/dnd'
import { cn } from '../../lib/cn'

export function AbilityScoreGrid({ stats, className }: { stats: Partial<Record<DndStat, number>>; className?: string }) {
  return (
    <div className={cn('grid grid-cols-6 gap-2 text-center phone:grid-cols-3', className)}>
      {DND_STATS.map((stat) => {
        const score = stats[stat] ?? 10
        return (
          <div key={stat} className="flex flex-col border border-line/40 tone-panel-40 px-1 py-2">
            <span className="text-[9.5px] font-bold caps text-dim">{stat}</span>
            <span className="font-data text-[14px] font-bold text-ink">{score}</span>
            <span className="font-data text-[10.5px] text-accent">{modifier(score)}</span>
          </div>
        )
      })}
    </div>
  )
}
