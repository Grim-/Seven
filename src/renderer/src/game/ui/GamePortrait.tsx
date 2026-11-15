import type { ReactNode } from 'react'
import { showName } from '@shared/ids'
import type { Catalog } from '@shared/game/core'
import type { PlaceVisitor } from '@shared/maps'
import { SheetPortrait } from '../../components/data/SheetPortrait'
import { RecordBars } from '../../components/game/ResourceBars'
import { useVfx } from '../../components/vfx'
import { cn } from '../../lib/cn'

export function GamePortrait({
  visitor,
  catalog,
  active,
  onClick,
  trailing,
  className
}: {
  visitor: PlaceVisitor
  catalog?: Catalog | null
  active?: boolean
  onClick?: () => void
  trailing?: ReactNode
  className?: string
}) {
  const vfxRef = useVfx<HTMLDivElement>(visitor.sheet ? `sheet:${visitor.sheet}` : null)
  return (
    <div
      ref={vfxRef}
      onClick={onClick}
      className={cn(
        'relative flex w-full items-start gap-2.5 px-2.5 py-2 text-left transition-colors',
        onClick && 'cursor-pointer hover:bg-white/[0.04]',
        active && 'bg-accent/10',
        className
      )}
    >
      <SheetPortrait image={visitor.image} usedBy={`The portrait of ${showName(visitor.name)}`} className={cn('h-10 w-10 shrink-0', active && 'border-accent')} />
      <span className="flex min-w-0 flex-1 flex-col gap-1 pr-2">
        <span className="truncate text-[13px] font-semibold text-white">{showName(visitor.name)}</span>
        {visitor.game && catalog ? (
          <RecordBars record={visitor.game} catalog={catalog} compact />
        ) : visitor.dnd?.hp ? (
          <div className="flex items-center gap-1.5 text-[10px]">
            <div className="h-2 flex-1 border border-line/40 bg-black/60">
              <div
                className="h-full bg-alert transition-all"
                style={{
                  width: `${Math.min(100, Math.max(0, (visitor.dnd.hp.cur / Math.max(1, visitor.dnd.hp.max)) * 100))}%`
                }}
              />
            </div>
            <span className="font-mono text-[9px] text-dim">
              {visitor.dnd.hp.cur}/{visitor.dnd.hp.max}
            </span>
          </div>
        ) : visitor.line ? (
          <span className="truncate font-mono text-[10px] text-dim">{visitor.line}</span>
        ) : null}
      </span>
      {trailing}
    </div>
  )
}
