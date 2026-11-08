import { showName } from '@shared/ids'
import type { Catalog } from '@shared/game/core'
import type { PlaceVisitor } from '@shared/maps'
import { SheetPortrait } from '../../components/data/SheetPortrait'
import { RecordBars } from '../../components/game/ResourceBars'
import { cn } from '../../lib/cn'

export function GamePortrait({ visitor, catalog, active, onClick, className }: { visitor: PlaceVisitor; catalog: Catalog; active?: boolean; onClick?: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex w-full items-start gap-2.5 px-2.5 py-2 text-left hover:bg-white/[0.04]', active && 'bg-accent/10', className)}>
      <SheetPortrait image={visitor.image} className={cn('h-10 w-10', active && 'border-accent')} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[13px] font-semibold text-white">{showName(visitor.name)}</span>
        {visitor.game && <RecordBars record={visitor.game} catalog={catalog} compact />}
      </span>
    </button>
  )
}
