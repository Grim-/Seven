import type { ReactNode } from 'react'
import { assetUrl, useAsset } from '../../store/data'
import { cn } from '../../lib/cn'

export function AssetMedia({ id, className, fallback }: { id: string; className?: string; fallback?: ReactNode }) {
  const asset = useAsset(id)
  if (asset?.kind === 'image') return <img src={assetUrl(asset)} alt={asset.name} draggable={false} className={cn('object-cover', className)} />
  if (asset?.kind === 'video') return <video src={assetUrl(asset)} muted preload="metadata" className={cn('object-cover', className)} />
  if (fallback !== undefined) return <>{fallback}</>
  return <div className={cn('flex items-center justify-center bg-black/60 font-mono text-[10px] uppercase text-faint', className)}>{asset === null ? 'Missing picture' : (asset?.name ?? '')}</div>
}
