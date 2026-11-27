import type { MouseEvent } from 'react'
import type { MapLink } from '@shared/maps'
import type { Size } from '@shared/shapes'
import { useViewZoom } from '../../space/viewZoom'
import type { MapThing } from './registry'

const centre = (t: MapThing) => ({ x: t.bounds.x + t.bounds.w / 2, y: t.bounds.y + t.bounds.h / 2 })

export function LinkLines({ size, links, things, label, onMenu }: { size: Size; links: MapLink[]; things: MapThing[]; label?: (link: MapLink) => string; onMenu?: (e: MouseEvent, link: MapLink) => void }) {
  const zoom = useViewZoom()
  const at = new Map(things.map((t) => [t.key, t]))
  const w = 2 / zoom
  return (
    <svg width={size.w} height={size.h} className="pointer-events-none absolute left-0 top-0 z-[34] overflow-visible">
      <defs>
        <marker id="link-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="fill-accent" />
        </marker>
      </defs>
      {links.map((link) => {
        const from = at.get(link.from)
        const to = at.get(link.to)
        if (!from || !to) return null
        const a = centre(from)
        const b = centre(to)
        const text = label?.(link) ?? ''
        return (
          <g key={link.id} data-keep onContextMenu={onMenu && ((e) => onMenu(e, link))} className="pointer-events-auto">
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={w * 6} className="stroke-transparent" />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={w} strokeDasharray={`${6 / zoom} ${4 / zoom}`} markerEnd="url(#link-arrow)" className="stroke-accent" />
            {text && (
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6 / zoom} fontSize={11 / zoom} textAnchor="middle" className="fill-accent font-ui">
                {text}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
