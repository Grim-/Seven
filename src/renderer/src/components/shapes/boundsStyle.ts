import type { CSSProperties } from 'react'
import type { Bounds, Size } from '@shared/shapes'

export function boundsStyle(b: Bounds, size: Size): CSSProperties {
  return { left: `${(b.x / size.w) * 100}%`, top: `${(b.y / size.h) * 100}%`, width: `${(b.w / size.w) * 100}%`, height: `${(b.h / size.h) * 100}%` }
}
