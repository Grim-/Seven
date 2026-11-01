import { EmptyState } from '../ui'
import { useAsset } from '../../store/data'
import { AssetCard, AssetPreview } from './AssetView'
import type { EntrySurfaceProps } from '../../registries/kinds'

function useFile(id: string) {
  const asset = useAsset(id)
  if (asset === undefined) return { asset: null, empty: <div className="font-mono text-[11px] text-dim">Loading…</div> }
  if (!asset) return { asset: null, empty: <EmptyState title="Removed">This file is no longer in Seven's files.</EmptyState> }
  return { asset, empty: null }
}

export function FileChat({ id }: EntrySurfaceProps) {
  const { asset, empty } = useFile(id)
  return asset ? <AssetCard asset={asset} /> : empty
}

export function FileStage({ id }: EntrySurfaceProps) {
  const { asset, empty } = useFile(id)
  return asset ? <AssetPreview asset={asset} large /> : empty
}
