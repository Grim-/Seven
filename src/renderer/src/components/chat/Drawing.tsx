import { useMemo } from 'react'
import { cleanSvg, svgDataUrl } from '@shared/svg'
import { assetUrl, useData } from '../../store/data'
import { assetByRef, useChatPictures } from '../pictures/chatPictures'
import { Picture } from '../pictures/Picture'
import { cn } from '../../lib/cn'

export function Drawing({ source, className }: { source: string; className?: string }) {
  const url = useMemo(() => {
    try {
      return svgDataUrl(cleanSvg(source))
    } catch {
      return null
    }
  }, [source])
  if (!url) return <div className="my-2 flex h-24 items-center justify-center border border-line/40 bg-black/40 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Drawing…</div>
  return <img src={url} alt="Drawing" draggable={false} className={cn('my-2 block h-auto max-h-[480px] max-w-full', className)} />
}

export function LibraryImage({ href, alt }: { href: string; alt: string }) {
  const ref = decodeURIComponent(href.replace(/^seven:\/*(?:file|asset)\//, ''))
  const asset = useData((s) => assetByRef(s.assets, ref))
  const chat = useChatPictures()
  if (!asset) return <span className="font-mono text-[11px] text-faint">[missing picture: {alt || ref}]</span>
  if (asset.kind === 'video') return <video src={assetUrl(asset)} controls className="my-2 max-h-[420px] max-w-full" />
  if (asset.kind === 'audio') return <audio src={assetUrl(asset)} controls className="my-2 w-full" />
  return <Picture asset={asset} maxHeight={chat ? chat.height : '480px'} fill={Boolean(chat)} className="my-2" />
}
