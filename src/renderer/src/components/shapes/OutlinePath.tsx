import type { Bounds, Point } from '@shared/shapes'

export function OutlinePath({ points, bounds, closed = true }: { points: Point[]; bounds: Bounds; closed?: boolean }) {
  const d = points.map((p) => `${p.x - bounds.x},${p.y - bounds.y}`).join(' ')
  return (
    <svg className="shape-path" viewBox={`0 0 ${bounds.w || 1} ${bounds.h || 1}`} preserveAspectRatio="none">
      {closed ? <polygon points={d} /> : <polyline points={d} />}
    </svg>
  )
}
