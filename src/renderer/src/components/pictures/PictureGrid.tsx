import type { MouseEvent, ReactNode } from 'react'
import { useData } from '../../store/data'
import { AssetMedia } from './AssetMedia'
import { cn } from '../../lib/cn'
import type { ReorderProps } from '../ui/reorder'

export interface PictureGridProps {
  ids: string[]
  min?: string
  wide?: boolean
  names?: boolean
  isOn?: (id: string) => boolean
  onPick: (id: string, index: number) => void
  onMenu?: (e: MouseEvent, id: string, index: number) => void
  reorder?: { props: (index: number) => ReorderProps; isOver: (index: number) => boolean; dragging: number | null }
  className?: string
  children?: ReactNode
}

export function PictureGrid({ ids, min = '8rem', wide = false, names = false, isOn, onPick, onMenu, reorder, className, children }: PictureGridProps) {
  const assets = useData((s) => s.assets)
  return (
    <div className={cn('grid gap-2', className)} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${min}, 1fr))` }}>
      {ids.map((id, i) => {
        const asset = assets.find((a) => a.id === id)
        return (
          <button
            key={id}
            {...reorder?.props(i)}
            title={asset?.name ?? 'A file that no longer exists'}
            onClick={() => onPick(id, i)}
            onContextMenu={onMenu ? (e) => onMenu(e, id, i) : undefined}
            className={cn(
              'group relative overflow-hidden border bg-panel',
              wide ? 'aspect-[4/3]' : 'aspect-square',
              isOn?.(id) || reorder?.isOver(i) ? 'border-accent' : 'border-line/50 hover:border-accent/70',
              reorder?.dragging === i && 'opacity-40'
            )}
          >
            <AssetMedia id={id} className="h-full w-full transition-transform group-hover:scale-105" />
            {names && asset && <span className="absolute inset-x-0 bottom-0 truncate tone-panel-70 px-1.5 py-0.5 text-left font-ui text-[10px] text-ink/85">{asset.name}</span>}
          </button>
        )
      })}
      {children}
    </div>
  )
}
