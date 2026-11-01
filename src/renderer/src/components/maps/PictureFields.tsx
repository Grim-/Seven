import { ImagePlus } from 'lucide-react'
import type { LayerBase, PictureLayer } from '@shared/maps'
import { Button, NumberField, SliderNumber } from '../ui'
import { failed } from '../../lib/notify'
import { pickMapPicture } from './addImageLayer'

const LABEL = 'font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint'
const FIELD = 'h-7 text-[12px]'

export function PictureFields<T extends LayerBase & PictureLayer>({ layer, onChange }: { layer: T; onChange: (next: T) => void }) {
  const picture = () =>
    void pickMapPicture('a new picture')
      .then((picked) => picked && onChange({ ...layer, image: picked.asset.id, size: picked.size }))
      .catch(failed('Could not change the picture'))
  return (
    <>
      <div className="grid grid-cols-[52px_1fr_1fr] items-center gap-1.5">
        <span className={LABEL}>Place</span>
        <NumberField value={layer.offset.x} step={1} onChange={(x) => onChange({ ...layer, offset: { ...layer.offset, x: x ?? layer.offset.x } })} className={FIELD} />
        <NumberField value={layer.offset.y} step={1} onChange={(y) => onChange({ ...layer, offset: { ...layer.offset, y: y ?? layer.offset.y } })} className={FIELD} />
      </div>
      <div className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-1.5">
        <span className={LABEL}>Scale</span>
        <SliderNumber value={layer.scale} min={0.01} max={4} step={0.05} openMax onChange={(scale) => onChange({ ...layer, scale })} className="w-full" />
        <span className={LABEL}>Turn °</span>
        <SliderNumber value={layer.rotation} min={0} max={359} step={1} onChange={(rotation) => onChange({ ...layer, rotation })} className="w-full" />
        <span className={LABEL}>Opacity</span>
        <SliderNumber value={layer.opacity} min={0} max={1} step={0.05} onChange={(opacity) => onChange({ ...layer, opacity })} className="w-full" />
      </div>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-[11.5px] text-faint">On the map: drag to move, the corner to scale, the dot above to turn (15° steps; Shift for any angle).</span>
        <Button size="sm" variant="ghost" icon={<ImagePlus />} onClick={picture}>
          Picture
        </Button>
      </div>
    </>
  )
}
