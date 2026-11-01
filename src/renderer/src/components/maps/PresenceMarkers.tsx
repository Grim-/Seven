import type { MouseEvent } from 'react'
import type { PlaceVisitor } from '@shared/maps'
import { SheetPortrait } from '../data/SheetPortrait'
import { HpBar } from './HpBar'

export function PresenceMarkers({ visitors, onMenu }: { visitors: PlaceVisitor[]; onMenu?: (e: MouseEvent, visitor: PlaceVisitor) => void }) {
  return (
    <>
      {visitors.map((v) => (
        <span key={v.sheet} title={`${v.name} · ${v.line}`} onContextMenu={onMenu && ((e) => onMenu(e, v))} className="pointer-events-auto flex w-5 flex-col gap-px">
          <SheetPortrait image={v.image} className="h-5 w-5 border-cyan" />
          {v.dnd && <HpBar hp={v.dnd.hp} thin />}
        </span>
      ))}
    </>
  )
}
