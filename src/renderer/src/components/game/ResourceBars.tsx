import { useMemo } from 'react'
import { resourcesOf, type ResourceView } from '@shared/game/components'
import { GameEntity, type Catalog, type EntityRecord } from '@shared/game/core'
import { GameBar } from '../../game/ui/GameBar'
import { cn } from '../../lib/cn'

export { barColour } from '../../game/ui/GameBar'

export function useResources(record: EntityRecord | null | undefined, catalog: Catalog | null): ResourceView[] | null {
  return useMemo(() => (record && catalog ? resourcesOf(GameEntity.fromRecord(record, catalog)) : null), [record, catalog])
}

export function ResourceBars({ resources, compact = false, className }: { resources: ResourceView[]; compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex flex-col', compact ? 'gap-0.5' : 'gap-1', className)}>
      {resources.map((r) => (
        <div key={r.stat} className="flex items-center gap-1.5" title={`${r.label} ${Math.round(r.current)} / ${Math.round(r.max)}`}>
          {!compact && <span className="w-14 shrink-0 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-faint">{r.label}</span>}
          <GameBar value={r.current} max={r.max} colour={r.colour} size={compact ? 'xs' : 'sm'} className="flex-1" />
          {!compact && <span className="w-14 shrink-0 text-right font-mono text-[10.5px] text-dim">{`${Math.round(r.current)}/${Math.round(r.max)}`}</span>}
        </div>
      ))}
    </div>
  )
}

export function RecordBars({ record, catalog, compact, className }: { record: EntityRecord; catalog: Catalog; compact?: boolean; className?: string }) {
  const resources = useResources(record, catalog)
  return resources ? <ResourceBars resources={resources} compact={compact} className={className} /> : null
}
