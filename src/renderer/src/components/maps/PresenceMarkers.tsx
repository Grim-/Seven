import type { MouseEvent } from 'react'
import { recordHealth } from '@shared/game/components'
import type { PlaceVisitor } from '@shared/maps'
import { useGameCatalog } from '../game/useGameCatalog'
import { SheetPortrait } from '../data/SheetPortrait'
import { HpBar } from './HpBar'

export function PresenceMarkers({ visitors, onMenu }: { visitors: PlaceVisitor[]; onMenu?: (e: MouseEvent, visitor: PlaceVisitor) => void }) {
  const catalog = useGameCatalog()
  return (
    <>
      {visitors.map((v) => {
        const hp = recordHealth(v.game, catalog) ?? v.dnd?.hp ?? null
        return (
          <span key={v.sheet} title={`${v.name} · ${v.line}`} onContextMenu={onMenu && ((e) => onMenu(e, v))} className="pointer-events-auto flex w-5 flex-col gap-px">
            <SheetPortrait image={v.image} className="h-5 w-5 border-cyan" />
            {hp && <HpBar hp={hp} thin />}
          </span>
        )
      })}
    </>
  )
}
