import { MissingFile } from '../../pictures/MissingFile'
import { useRef, type MouseEvent } from 'react'
import type { LayerBase, PictureLayer } from '@shared/maps'
import { assetUrl, useAsset } from '../../../store/data'
import { cn } from '../../../lib/cn'
import { useViewZoom } from '../../space/viewZoom'
import { useSpaceDrag, type SpaceDrag } from '../../space/useSpaceDrag'
import type { PicturePatch } from '../mapObjects'

const MIN_SCALE = 0.01

type Mode = 'move' | 'size' | 'turn'
type Picture = LayerBase & PictureLayer

const degrees = (r: number) => (r * 180) / Math.PI

function patchOf(layer: Picture, d: SpaceDrag<Mode>, zoom: number): PicturePatch {
  if (d.mode === 'move') return { offset: { x: Math.round(layer.offset.x + d.delta.x / zoom), y: Math.round(layer.offset.y + d.delta.y / zoom) } }
  if (d.mode === 'turn') {
    const angle = degrees(Math.atan2(d.pointer.y - d.center.y, d.pointer.x - d.center.x)) + 90
    return { rotation: Math.round(d.shift ? angle : Math.round(angle / 15) * 15) % 360 }
  }
  const turn = (-layer.rotation * Math.PI) / 180
  const lx = (d.delta.x * Math.cos(turn) - d.delta.y * Math.sin(turn)) / zoom
  const ly = (d.delta.x * Math.sin(turn) + d.delta.y * Math.cos(turn)) / zoom
  const w = layer.size.w * layer.scale
  const h = layer.size.h * layer.scale
  const k = Math.max((w + lx) / w, (h + ly) / h)
  return { scale: Math.max(MIN_SCALE, Math.round(layer.scale * k * 100) / 100) }
}

interface Props {
  layer: Picture
  editing: boolean
  selected: boolean
  hit: boolean
  onChange?: (patch: PicturePatch) => void
  onPress?: (e: MouseEvent) => void
  onClick?: (e: MouseEvent) => void
  onMenu?: (e: MouseEvent) => void
}

export function PictureBox({ layer, editing, selected, hit, onChange, onPress, onClick, onMenu }: Props) {
  const isDataUri = layer.image.startsWith('data:')
  const asset = useAsset(isDataUri ? '' : layer.image, `The map layer ${layer.name}`)
  const zoom = useViewZoom()
  const box = useRef<HTMLDivElement>(null)
  const drag = useSpaceDrag<Mode>(
    editing,
    (d) => onChange?.(patchOf(layer, d, zoom)),
    (e, mode) => mode === 'move' && onPress?.(e)
  )
  if (!isDataUri && asset === undefined) return null
  const shown = { ...layer, ...(drag.live ? patchOf(layer, drag.live, zoom) : {}) }
  const offset = { x: shown.offset.x - layer.offset.x, y: shown.offset.y - layer.offset.y }
  return (
    <div
      ref={box}
      data-hit={hit || undefined}
      title={hit ? layer.name : undefined}
      onPointerDown={drag.begin('move', box)}
      onPointerMove={drag.move}
      onPointerUp={drag.end}
      onClick={onClick}
      onContextMenu={onMenu}
      style={{ width: shown.size.w * shown.scale, height: shown.size.h * shown.scale, transform: `translate(${offset.x}px, ${offset.y}px) rotate(${shown.rotation}deg)`, transformOrigin: 'center' }}
      className={cn('relative', hit ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none', editing && 'cursor-move', selected && 'outline-dashed outline-1 outline-secondary-ink')}
    >
      {isDataUri || asset ? <img src={isDataUri ? layer.image : assetUrl(asset!)} alt={layer.name} draggable={false} className="block h-full w-full max-w-none select-none" /> : <MissingFile className="h-full w-full" />}
      {selected && editing && (
        <>
          <span data-hit onPointerDown={drag.begin('turn', box)} title="Turn (Shift: any angle)" className="shape-handle shape-point pointer-events-auto -top-5 left-1/2 cursor-grab rounded-full" />
          <span data-hit onPointerDown={drag.begin('size', box)} title="Scale" className="shape-handle pointer-events-auto -bottom-1 -right-1 cursor-nwse-resize" />
        </>
      )}
    </div>
  )
}
