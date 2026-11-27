import { showName } from '@shared/ids'
import { cn } from '../../lib/cn'
import { useEntryPreview } from '../entries/entryPreview'
import { SheetPortrait } from '../data/SheetPortrait'
import type { TableSeat } from './seats'

export function useSeatName(seat: TableSeat, factionName: (id: string) => string): string {
  const preview = useEntryPreview(seat.sheet ? `@sheet:${seat.sheet}` : '')
  const title = preview && !('missing' in preview) ? showName(preview.title) : ''
  return title || seat.name || (seat.faction ? factionName(seat.faction) : '') || 'Unnamed'
}

export function Seat({ seat, name, factionName, speaking, x, y }: { seat: TableSeat; name: string; factionName: (id: string) => string; speaking: boolean; x: number; y: number }) {
  const preview = useEntryPreview(seat.sheet ? `@sheet:${seat.sheet}` : '')
  const image = preview && !('missing' in preview) ? (preview.image ?? null) : null
  return (
    <div className="absolute flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center" style={{ left: `${x}%`, top: `${y}%` }}>
      <div className={cn('h-16 w-16 overflow-hidden border-2 tone-well-80 transition-all', speaking ? 'scale-110 border-accent shadow-[0_0_18px_color-mix(in_srgb,var(--color-accent)_calc(45%*var(--glow)),transparent)]' : 'border-line-strong')}>
        {seat.sheet ? (
          <SheetPortrait image={image} className="h-full w-full" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-label text-[22px] text-secondary-ink">{name.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <span className={cn('truncate text-[12px] font-semibold', speaking ? 'text-accent' : 'text-ink')}>{name}</span>
      {seat.faction && <span className="truncate font-label text-[9.5px] caps-5 text-secondary-ink">{factionName(seat.faction)}</span>}
      {seat.role && <span className="truncate text-[10px] text-dim">{seat.role}</span>}
    </div>
  )
}
