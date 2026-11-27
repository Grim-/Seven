import { useEffect, useState } from 'react'
import { ExternalLink, FileIcon, FolderOpen } from 'lucide-react'
import { useChatPictures } from '../pictures/chatPictures'
import { Picture } from '../pictures/Picture'
import { openEntry } from '../../lib/library'
import { PictureGrid } from '../pictures/PictureGrid'
import type { AssetMeta } from '@shared/types'
import { Button } from '../ui'
import { main } from '../../lib/ipc'
import { errorText, formatBytes } from '../../lib/format'
import { assetUrl, useAsset, useData } from '../../store/data'
import { cn } from '../../lib/cn'

const MAX_TEXT = 200_000

function openAsset(id: string, reveal: boolean): void {
  main('asset.open', { id, reveal }).catch(failed('Could not open file'))
}

function AssetActions({ asset }: { asset: AssetMeta }) {
  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="ghost" icon={<ExternalLink />} onClick={() => openAsset(asset.id, false)}>
        Open
      </Button>
      <Button size="sm" variant="ghost" icon={<FolderOpen />} onClick={() => openAsset(asset.id, true)}>
        Show
      </Button>
    </div>
  )
}

function TextPreview({ asset, maxHeight }: { asset: AssetMeta; maxHeight: string }) {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    fetch(assetUrl(asset))
      .then((r) => r.text())
      .then((t) => live && setText(t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT)}\n… truncated …` : t))
      .catch((err) => live && setText(`Could not read: ${errorText(err)}`))
    return () => {
      live = false
    }
  }, [asset])
  return (
    <pre className={cn('overflow-auto border border-line/40 tone-panel-70 px-2.5 py-1.5 font-ui text-[12px] leading-relaxed text-ink/90', maxHeight)}>
      {text ?? 'Loading…'}
    </pre>
  )
}

import { PageControls, PageFrame, isPage } from './PageFrame'
import { failed } from '../../lib/notify'

export function AssetPreview({ asset, large = false }: { asset: AssetMeta; large?: boolean }) {
  const chat = useChatPictures()
  const url = assetUrl(asset)
  const maxHeight = large ? 'max-h-[70vh]' : 'max-h-96'
  if (isPage(asset))
    return (
      <div className="flex flex-col gap-2">
        <PageControls asset={asset} />
        <PageFrame asset={asset} className={cn('border border-line/40', large ? 'h-[70vh]' : 'h-96')} />
      </div>
    )
  switch (asset.kind) {
    case 'image':
      return <Picture asset={asset} maxHeight={chat ? chat.height : large ? '70vh' : '24rem'} fill={Boolean(chat)} />
    case 'audio':
      return <audio src={url} controls className="w-full" />
    case 'video':
      return <video src={url} controls className={cn('max-w-full border border-line/40 bg-panel', maxHeight)} />
    case 'pdf':
      return <iframe src={url} title={asset.name} className={cn('w-full border border-line/40 bg-page', large ? 'h-[70vh]' : 'h-96')} />
    case 'code':
    case 'text':
      return <TextPreview asset={asset} maxHeight={maxHeight} />
    default:
      return (
        <div className="flex items-center gap-2 border border-line/40 tone-panel-50 px-3 py-2">
          <FileIcon className="h-5 w-5 text-dim" />
          <span className="font-ui text-[12.5px] text-ink">{asset.name}</span>
          <span className="font-ui text-[11px] text-faint">{formatBytes(asset.size)}</span>
        </div>
      )
  }
}

export function AssetCard({ asset }: { asset: AssetMeta }) {
  return (
    <div className="flex flex-col gap-1.5">
      <AssetPreview asset={asset} />
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate font-ui text-[11.5px] text-ink/85">{asset.name}</span>
        <span className="font-ui text-[10.5px] text-faint">{formatBytes(asset.size)}</span>
        <div className="ml-auto">
          <AssetActions asset={asset} />
        </div>
      </div>
    </div>
  )
}

export function Gallery({ assets }: { assets: AssetMeta[] }) {
  return <PictureGrid ids={assets.map((a) => a.id)} min="140px" names onPick={(id) => openEntry('file', id)} />
}

function AssetById({ id }: { id: string }) {
  const asset = useAsset(id)
  if (asset === undefined) return <div className="font-ui text-[11px] text-dim">Loading…</div>
  if (!asset) return <div className="font-ui text-[11.5px] text-faint">A file that no longer exists ({id})</div>
  return <AssetCard asset={asset} />
}

export function LiveAssets({ assetIds, title }: { assetIds: string[]; title?: string }) {
  const known = useData((s) => s.assets)
  const assets = assetIds.map((id) => known.find((a) => a.id === id))
  const allImages = assets.length > 1 && assets.every((a) => a?.kind === 'image')
  return (
    <div className="flex flex-col gap-2">
      {title && <div className="text-[13px] text-ink/90">{title}</div>}
      {allImages ? (
        <Gallery assets={assets as AssetMeta[]} />
      ) : (
        assetIds.map((id) => <AssetById key={id} id={id} />)
      )}
    </div>
  )
}
