import { useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, Pause, Play } from 'lucide-react'
import { Button, EmptyState } from '../ui'
import { assetUrl, useData } from '../../store/data'
import { cn } from '../../lib/cn'
import { AssetMedia } from '../pictures/AssetMedia'
import { playSlideshow, useCycle, useSlideshow } from './useSlideshow'

export function SlideshowPlayer({ id, controls = true, className }: { id: string; controls?: boolean; className?: string }) {
  const show = useSlideshow(id)
  const assets = useData((s) => s.assets)
  const [playing, setPlaying] = useState(true)
  const { order, index, step } = useCycle(show?.pictures ?? [], show?.seconds ?? 0, show?.shuffle ?? false, playing)
  if (show === undefined) return controls ? <div className="font-ui text-[11px] text-dim">Loading…</div> : null
  if (!show) return controls ? <EmptyState title="Gone">This slideshow no longer exists.</EmptyState> : null
  if (!order.length) return controls ? <EmptyState title="No pictures yet">Add pictures to the slideshow in Data.</EmptyState> : null
  const asset = assets.find((a) => a.id === order[index])
  return (
    <div className={cn('flex h-full min-h-0 w-full flex-col', className)}>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {asset && (
          <img
            key={asset.id}
            src={assetUrl(asset)}
            alt={asset.name}
            draggable={false}
            onClick={controls ? () => playSlideshow(id) : undefined}
            className={cn('absolute inset-0 h-full w-full', show.fit === 'cover' ? 'object-cover' : 'object-contain', controls && 'cursor-zoom-in')}
            style={{ animation: 'reveal-fade 0.6s ease-out both' }}
          />
        )}
        {show.captions && asset && <div className="absolute inset-x-0 bottom-0 truncate tone-panel-60 px-2 py-1 text-center font-ui text-[11px] text-ink/85">{asset.name}</div>}
      </div>
      {controls && (
        <div className="flex shrink-0 items-center justify-center gap-1 pt-1.5">
          <Button size="sm" variant="ghost" icon={<ChevronLeft />} title="Previous" onClick={() => step(-1)} />
          <Button size="sm" variant="ghost" icon={playing ? <Pause /> : <Play />} title={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(!playing)} />
          <Button size="sm" variant="ghost" icon={<ChevronRight />} title="Next" onClick={() => step(1)} />
          <span className="font-ui text-[11px] text-faint">
            {index + 1} / {order.length}
          </span>
          <Button size="sm" variant="ghost" icon={<Maximize2 />} title="Play on the stage" onClick={() => playSlideshow(id)} />
        </div>
      )}
    </div>
  )
}

export function SlideshowThumb({ id }: { id: string }) {
  const first = useSlideshow(id)?.pictures[0]
  return first ? <AssetMedia id={first} className="h-full w-full" fallback={null} /> : null
}

export function SlideshowPart({ id }: { id: string }) {
  return (
    <div className="flex h-full min-h-[16rem] flex-col">
      <SlideshowPlayer id={id} />
    </div>
  )
}
