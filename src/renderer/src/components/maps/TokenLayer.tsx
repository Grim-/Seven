import type { MenuEvent } from '../ui/ContextMenu'
import type { TokenVisitor } from '@shared/maps'
import type { Point } from '@shared/shapes'
import { showName } from '@shared/ids'
import { cn } from '../../lib/cn'
import { useViewZoom } from '../space/viewZoom'
import { useSpaceDrag } from '../space/useSpaceDrag'
import { SheetPortrait } from '../data/SheetPortrait'
import { useVfx } from '../vfx'
import { HpBar } from './HpBar'

export interface MapToken {
  visitor: TokenVisitor
  at: Point
}

export interface TokenHandlers {
  mine?: string | null
  onPick?: (token: MapToken, e: MenuEvent) => void
  onMenu?: (token: MapToken, e: MenuEvent) => void
  onMove?: (token: string, at: Point) => void
}

const SMALLEST = 40

function Token({ token, handlers, mapSize }: { token: MapToken; handlers: TokenHandlers; mapSize: number }) {
  const zoom = useViewZoom()
  const px = Math.max(SMALLEST, mapSize * zoom)
  const drag = useSpaceDrag<'move'>(
    Boolean(handlers.onMove),
    (d) => handlers.onMove?.(token.visitor.token, { x: Math.round(token.at.x + d.delta.x / zoom), y: Math.round(token.at.y + d.delta.y / zoom) }),
    (e) => handlers.onPick?.(token, e)
  )
  const shift = drag.live ? { x: drag.live.delta.x / zoom, y: drag.live.delta.y / zoom } : { x: 0, y: 0 }
  const v = token.visitor
  const isMine = v.sheet === handlers.mine
  if (v.hidden && !isMine && !handlers.onMove) return null
  const vfxRef = useVfx<HTMLSpanElement>([`token:${v.token}`, v.sheet ? `sheet:${v.sheet}` : null, v.agent ? `agent:${v.agent}` : null])
  return (
    <div
      data-hit
      title={`${showName(v.name)} · ${v.line}`}
      onPointerDown={drag.begin('move')}
      onPointerMove={drag.move}
      onPointerUp={drag.end}
      onClick={(e) => !handlers.onMove && handlers.onPick?.(token, e)}
      onContextMenu={(e) => handlers.onMenu?.(token, e)}
      style={{ left: token.at.x + shift.x, top: token.at.y + shift.y, width: px, transform: `scale(${1 / zoom}) translate(-50%, -50%)` }}
      className={cn(
        'pointer-events-auto absolute flex flex-col items-center gap-1 [transform-origin:0_0]',
        handlers.onMove ? 'cursor-grab' : 'cursor-pointer',
        v.hidden && 'opacity-40'
      )}
    >
      <span ref={vfxRef} style={{ width: px, height: px }}>
        <SheetPortrait image={v.image} usedBy={`The map token ${showName(v.name)}`} className={cn('h-full w-full border-2 shadow-[0_4px_14px_rgba(0,0,0,0.7)]', v.sheet === handlers.mine ? 'border-accent' : v.agent ? 'border-purple' : 'border-cyan')} />
      </span>
      {v.hp && <HpBar hp={v.hp} thin className="w-full" />}
      <span className="max-w-[160px] truncate bg-black/85 px-1.5 py-0.5 font-mono text-[11px] text-white">{showName(v.name)}</span>
    </div>
  )
}

export function TokenLayer({ tokens, handlers, mapSize }: { tokens: MapToken[]; handlers: TokenHandlers; mapSize: number }) {
  return (
    <span className="pointer-events-none absolute inset-0 z-[4]">
      {tokens.map((t) => (
        <Token key={t.visitor.token} token={t} handlers={handlers} mapSize={mapSize} />
      ))}
    </span>
  )
}
