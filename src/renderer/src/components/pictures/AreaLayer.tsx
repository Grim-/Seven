import type { AssetMeta, PictureArea } from '@shared/types'
import type { Shape } from '@shared/shapes'
import { namedAreas, useAreaAction } from './areaAction'
import { useAsset } from '../../store/data'
import { AssetMedia } from './AssetMedia'
import { ShapeOverlay } from '../shapes/ShapeOverlay'

export const PICTURE_SPACE = { w: 1, h: 1 }

export function areaShape(a: PictureArea, label = a.name): Shape {
  return { id: a.id, label, title: a.note || a.name, form: { kind: 'box', x: a.x, y: a.y, w: a.w, h: a.h } }
}

export function AreaLayer({ asset }: { asset: AssetMeta }) {
  const pick = useAreaAction()
  const areas = namedAreas(asset.areas)
  return <ShapeOverlay size={PICTURE_SPACE} shapes={areas.map((a) => areaShape(a))} onPick={pick ? (s) => pick(areas.find((a) => a.id === s.id)!) : undefined} />
}

export function AreaChips({ asset }: { asset: AssetMeta }) {
  const pick = useAreaAction()
  const areas = namedAreas(asset.areas)
  if (!pick || !areas.length) return null
  return (
    <span className="mt-1.5 flex flex-wrap gap-1.5">
      {areas.map((a) => (
        <button key={a.id} type="button" title={a.note || a.name} onClick={() => pick(a)} className="area-chip">
          {a.name}
        </button>
      ))}
    </span>
  )
}

export function AreaMedia({ id, className }: { id: string; className?: string }) {
  const asset = useAsset(id)
  return (
    <span className="flex flex-col items-center">
      <span className="relative inline-block">
        <AssetMedia id={id} className={className} />
        {asset && <AreaLayer asset={asset} />}
      </span>
      {asset && <AreaChips asset={asset} />}
    </span>
  )
}
