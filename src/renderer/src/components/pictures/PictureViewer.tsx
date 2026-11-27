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
import { ZoomableImageViewport } from './ZoomableImageViewport'

export function PictureViewerHost() {
  const request = usePictureViewer((s) => s.request)
  if (!request) return null
  return <PictureViewer key={`${request.ids.join(',')}|${request.at}`} request={request} />
}

function PictureViewer({ request }: { request: PictureRequest }) {
  const assets = useData((s) => s.assets)
  const [playing, setPlaying] = useState(request.seconds !== null)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const count = request.ids.length
  const { index: at, step } = useStepper(count, request.at, request.seconds, playing)
  const asset = assets.find((a) => a.id === request.ids[at])

  useEffect(() => {
    setDims(null)
  }, [asset?.id])

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
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-scrim/92"
      onContextMenu={(e) => {
        e.preventDefault()
        closePictures()
      }}
    >
      <div className="z-20 flex shrink-0 items-center gap-2 border-b border-line/40 tone-panel-85 px-4 py-2 backdrop-blur-[var(--panel-blur)]" onClick={(e) => e.stopPropagation()}>
        <span className="min-w-0 truncate font-ui text-[12px] text-ink">{asset?.name ?? 'A file that no longer exists'}</span>
        {dims && (
          <span className="font-data text-[11px] text-secondary-ink">
            {dims.w} × {dims.h}
          </span>
        )}
        {count > 1 && (
          <span className="font-ui text-[11px] text-faint">
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

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {asset ? (
          asset.kind === 'video' ? (
            <div className="flex h-full w-full items-center justify-center p-6" onClick={closePictures}>
              <video key={asset.id} src={assetUrl(asset)} controls autoPlay className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()} />
            </div>
          ) : (
            <ZoomableImageViewport
              imageKey={asset.id}
              src={assetUrl(asset)}
              alt={asset.name}
              onDimensions={setDims}
              onBackdropClick={closePictures}
            />
          )
        ) : null}

        {count > 1 && (
          <>
            <Button
              variant="secondary"
              icon={<ChevronLeft />}
              title="Previous"
              onClick={(e) => (e.stopPropagation(), step(-1))}
              className="absolute left-3 top-1/2 z-20 -translate-y-1/2"
            />
            <Button
              variant="secondary"
              icon={<ChevronRight />}
              title="Next"
              onClick={(e) => (e.stopPropagation(), step(1))}
              className="absolute right-3 top-1/2 z-20 -translate-y-1/2"
            />
          </>
        )}
      </div>
    </div>
  )
}
