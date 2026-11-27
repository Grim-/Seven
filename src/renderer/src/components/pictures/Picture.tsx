import { Maximize2 } from 'lucide-react'
import type { AssetMeta } from '@shared/types'
import { assetUrl } from '../../store/data'
import { cn } from '../../lib/cn'
import { openEntry } from '../../lib/library'
import { AreaChips, AreaLayer } from './AreaLayer'

export function Picture({ asset, maxHeight, fill = false, className }: { asset: AssetMeta; maxHeight?: number | string; fill?: boolean; className?: string }) {
  const open = () => openEntry('file', asset.id)
  return (
    <span className={cn('group relative block max-w-full', fill ? 'w-full' : 'w-fit', className)}>
      <img src={assetUrl(asset)} alt={asset.name} draggable={false} onClick={open} className={cn('block h-auto max-w-full cursor-zoom-in object-contain', fill ? 'w-full' : 'border border-line/40')} style={maxHeight ? { maxHeight } : undefined} />
      <AreaLayer asset={asset} />
      <button title="Open" onClick={open} className="absolute right-1.5 top-1.5 z-[4] hidden items-center gap-1 border border-line/50 tone-well-70 px-1.5 py-0.5 font-ui text-[10.5px] text-dim hover:text-ink group-hover:flex">
        <Maximize2 className="h-3 w-3" />
        Open
      </button>
      <AreaChips asset={asset} />
    </span>
  )
}
