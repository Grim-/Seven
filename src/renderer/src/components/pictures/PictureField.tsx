import { Aperture, Images, ImagePlus, X } from 'lucide-react'
import { Button } from '../ui'
import { AssetMedia } from './AssetMedia'
import type { PictureOptions } from '../data/PicturePicker'
import { usePicturePick } from './usePicturePick'
import { cn } from '../../lib/cn'

export function PictureField({ value, onChange, options = {}, large = false, clearable = true }: { value: string | null; onChange: (id: string | null) => void; options?: PictureOptions; large?: boolean; clearable?: boolean }) {
  const { fromSeven, fromDisk, fromGenerate } = usePicturePick(value, onChange, options)
  const canGenerate = !options.kinds || options.kinds.includes('image')
  return (
    <div className={cn('flex gap-2', large ? 'flex-col' : 'items-center')}>
      {(value || large) && (
        <div className={cn('shrink-0 overflow-hidden border border-line/60 tone-panel-50', large ? 'flex aspect-[4/3] w-full items-center justify-center' : 'h-10 w-10')}>
          {value ? <AssetMedia id={value} className="h-full w-full" /> : <span className="text-[12px] text-faint">No picture yet</span>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="secondary" icon={<Images />} onClick={fromSeven}>
          Library
        </Button>
        <Button size="sm" variant="secondary" icon={<ImagePlus />} onClick={fromDisk}>
          Upload
        </Button>
        {canGenerate && (
          <Button size="sm" variant="secondary" icon={<Aperture />} onClick={fromGenerate}>
            Generate
          </Button>
        )}
        {value && clearable && (
          <Button size="sm" variant="ghost" icon={<X />} onClick={() => onChange(null)}>
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
