import { useState } from 'react'
import { Images, ImagePlus, Grid, X } from 'lucide-react'
import type { Size } from '@shared/shapes'
import type { MapObjectGraphicSource } from '@shared/game/mapObjects'
import { Button } from '../ui'
import { AssetMedia } from '../pictures/AssetMedia'
import { pickPicture } from '../data/PicturePicker'
import { choosePictures } from '../../lib/importFiles'
import { TilePicker, type TilePickResult } from './TilePicker'

interface MapObjectGraphicPickerProps {
  image: string
  size: Size
  graphicSource?: MapObjectGraphicSource
  onChange: (image: string, size: Size, graphicSource?: MapObjectGraphicSource) => void
}

export function MapObjectGraphicPicker({
  image,
  size,
  graphicSource,
  onChange
}: MapObjectGraphicPickerProps) {
  const [tilePickerOpen, setTilePickerOpen] = useState(false)

  const handlePickSeven = async () => {
    const res = await pickPicture(image || null, { what: 'an object sprite' })
    if (res?.id) {
      onChange(res.id, { w: 32, h: 32 }, { type: 'seven', assetId: res.id })
    }
  }

  const handlePickDisk = async () => {
    const [added] = await choosePictures(['image'], false, 'an object sprite')
    if (added?.id) {
      onChange(added.id, { w: 32, h: 32 }, { type: 'file', assetId: added.id })
    }
  }

  const handleTilePicked = (res: TilePickResult) => {
    onChange(
      res.croppedDataUrl,
      { w: res.tileW, h: res.tileH },
      {
        type: 'tile',
        assetId: res.assetId,
        col: res.col,
        row: res.row,
        tileW: res.tileW,
        tileH: res.tileH,
        gid: res.gid
      }
    )
  }

  const handleClear = () => {
    onChange('', { w: 32, h: 32 }, undefined)
  }

  const isDataUrl = image.startsWith('data:')

  return (
    <div className="flex flex-col gap-2 font-mono text-[11px]">
      <div className="flex items-center gap-3">
        {/* Sprite Preview Box */}
        <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-line bg-black/60 p-1">
          {image ? (
            isDataUrl ? (
              <img src={image} alt="Sprite preview" className="h-full w-full object-contain [image-rendering:pixelated]" />
            ) : (
              <AssetMedia id={image} className="h-full w-full object-contain [image-rendering:pixelated]" />
            )
          ) : (
            <span className="text-[10px] text-faint text-center leading-tight">No sprite</span>
          )}
        </div>

        {/* 3 Source Pick Buttons */}
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant={graphicSource?.type === 'seven' ? 'primary' : 'secondary'}
              icon={<Images className="h-3.5 w-3.5" />}
              onClick={handlePickSeven}
            >
              Image from Seven
            </Button>

            <Button
              size="sm"
              variant={graphicSource?.type === 'file' ? 'primary' : 'secondary'}
              icon={<ImagePlus className="h-3.5 w-3.5" />}
              onClick={() => void handlePickDisk()}
            >
              Image from Disk...
            </Button>

            <Button
              size="sm"
              variant={graphicSource?.type === 'tile' ? 'primary' : 'secondary'}
              icon={<Grid className="h-3.5 w-3.5" />}
              onClick={() => setTilePickerOpen(true)}
            >
              Select from Tilesheet...
            </Button>

            {image && (
              <Button size="sm" variant="ghost" icon={<X className="h-3.5 w-3.5" />} onClick={handleClear}>
                Clear
              </Button>
            )}
          </div>

          {/* Readout of current selection */}
          {image && (
            <div className="flex items-center gap-2 text-[10px] text-dim">
              <span>Size: {size.w}×{size.h}px</span>
              {graphicSource?.type === 'tile' && (
                <span className="text-accent">
                  · Tilesheet Tile (Col {graphicSource.col}, Row {graphicSource.row})
                </span>
              )}
              {graphicSource?.type === 'seven' && <span>· Seven Asset: {image}</span>}
              {graphicSource?.type === 'file' && <span>· Disk File Asset</span>}
            </div>
          )}
        </div>
      </div>

      <TilePicker
        open={tilePickerOpen}
        onClose={() => setTilePickerOpen(false)}
        onPick={handleTilePicked}
        initialAssetId={graphicSource?.type === 'tile' ? graphicSource.assetId : ''}
        initialTileW={size.w}
        initialTileH={size.h}
      />
    </div>
  )
}
