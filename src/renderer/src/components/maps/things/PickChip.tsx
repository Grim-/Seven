import { useViewZoom } from '../../space/viewZoom'
import type { PickChipState } from './useThingPicking'

export function PickChip({ chip }: { chip: PickChipState }) {
  const zoom = useViewZoom()
  return (
    <span
      style={{ left: chip.at.x, top: chip.at.y, transform: `scale(${1 / zoom}) translate(12px, 12px)` }}
      className="pointer-events-none absolute z-40 flex items-center gap-1.5 whitespace-nowrap border border-accent/60 tone-panel-95 px-1.5 py-0.5 font-ui text-[11px] text-ink shadow-panel [transform-origin:0_0]"
    >
      <span className="font-data text-accent">
        {chip.index + 1} / {chip.count}
      </span>
      <span className="max-w-[180px] truncate">{chip.label}</span>
    </span>
  )
}
