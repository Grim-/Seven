import { MissingFile } from './MissingFile'
import type { ReactNode } from 'react'
import { assetUrl, useAsset } from '../../store/data'
import { cn } from '../../lib/cn'

export function AssetMedia({ id, className, fallback, usedBy }: { id: string; className?: string; fallback?: ReactNode; usedBy?: string }) {
  const asset = useAsset(id, usedBy)
  if (asset?.kind === 'image') return <img src={assetUrl(asset)} alt={asset.name} loading="lazy" decoding="async" draggable={false} className={cn('object-cover', className)} />
  if (asset?.kind === 'video') return <video src={assetUrl(asset)} muted preload="metadata" className={cn('object-cover', className)} />
  if (asset === null) return <MissingFile label="Missing picture" className={className} />
  if (fallback !== undefined) return <>{fallback}</>
  return <div className={cn('flex items-center justify-center tone-panel-60 font-label text-[10px] caps text-faint', className)}>{asset?.name ?? ''}</div>
}
