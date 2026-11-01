import type { DndStats } from '@shared/dnd'
import { SegmentBar } from '../ui/Meter'

export function HpBar({ hp, thin = false, className }: { hp: DndStats['hp']; thin?: boolean; className?: string }) {
  const value = hp.max ? hp.cur / hp.max : 0
  return <SegmentBar value={value} tone={value < 0.4 ? 'hot' : 'cool'} segments={thin ? 6 : 20} thin={thin} className={className} />
}
