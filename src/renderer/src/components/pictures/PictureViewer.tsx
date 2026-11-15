import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, MoreHorizontal, Pause, Play, X } from 'lucide-react'
import { Button, openMenu } from '../ui'
import { assetUrl, useData } from '../../store/data'
import { saveAsset } from '../../lib/exporting'
import { addToSlideshowMenu } from '../slideshow/slideshowActions'
import { closePictures, usePictureViewer, type PictureRequest } from './pictureStore'
import { useStepper } from './useStepper'
import { useEscapeLayer } from '../../lib/escape'
import { matchesKeybind } from '../../store/keybinds'

export function PictureViewerHost() {
  const request = usePictureViewer((s) => s.request)
  if (!request) return null
  return <PictureViewer key={`${request.ids.join(',')}|${request.at}`} request={request} />
}

function PictureViewer({ request }: { request: PictureRequest }) {
  const assets = useData((s) => s.assets)
  const [playing, setPlaying] = useState(request.seconds !== null)
  const count = request.ids.length
  const { index: at, step } = useStepper(count, request.at, request.seconds, playing)
  const asset = assets.find((a) => a.id === request.ids[at])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (matchesKeybind('viewer.prev', e)) step(-1)
      else if (matchesKeybind('viewer.next', e)) step(1)
      else if (matchesKeybind('viewer.playPause', e) && request.seconds !== null) {
        e.preventDefault()
        setPlaying((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count, request.seconds])
  useEscapeLayer(true, closePictures)

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-black/90" onClick={closePictures}>
      <div className="flex shrink-0 items-center gap-2 px-4 py-2" onClick={(e) => e.stopPropagation()}>
        <span className="min-w-0 truncate font-mono text-[12px] text-white">{asset?.name ?? 'A file that no longer exists'}</span>
        {count > 1 && (
          <span className="font-mono text-[11px] text-faint">
            {at + 1} of {count}
          </span>
        )}
        <span className="flex-1" />
        {request.seconds !== null && count > 1 && <Button size="sm" variant="ghost" icon={playing ? <Pause /> : <Play />} title={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(!playing)} />}
        {asset && (
          <>
            <Button size="sm" variant="ghost" icon={<Download />} onClick={() => void saveAsset(asset.id, asset.name)}>
              Save a copy
            </Button>
            <Button size="sm" variant="ghost" icon={<MoreHorizontal />} title="More" onClick={(e) => openMenu(e, asset.name, [addToSlideshowMenu([asset.id])])} />
          </>
        )}
        <Button size="sm" variant="ghost" icon={<X />} title="Close" onClick={closePictures} />
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-6">
        {asset ? (
          asset.kind === 'video' ? (
            <video key={asset.id} src={assetUrl(asset)} controls autoPlay className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()} />
          ) : (
            <img key={asset.id} src={assetUrl(asset)} alt={asset.name} draggable={false} className="max-h-full max-w-full object-contain" style={{ animation: 'reveal-fade 0.4s ease-out both' }} onClick={(e) => e.stopPropagation()} />
          )
        ) : null}
        {count > 1 && (
          <>
            <Button variant="secondary" icon={<ChevronLeft />} title="Previous" onClick={(e) => (e.stopPropagation(), step(-1))} className="absolute left-3 top-1/2 -translate-y-1/2" />
            <Button variant="secondary" icon={<ChevronRight />} title="Next" onClick={(e) => (e.stopPropagation(), step(1))} className="absolute right-3 top-1/2 -translate-y-1/2" />
          </>
        )}
      </div>
    </div>
  )
}
