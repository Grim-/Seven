export type NearSide = 'top' | 'bottom'
export type NearAlign = 'center' | 'end' | 'start'

const GAP = 6
const EDGE = 4

export function fitNear(
  anchor: DOMRect,
  box: DOMRect,
  side: NearSide,
  align: NearAlign
): { left: number; top: number } {
  const above = anchor.top - box.height - GAP
  const below = anchor.bottom + GAP
  const top =
    side === 'top'
      ? above >= EDGE
        ? above
        : below
      : below + box.height <= window.innerHeight - EDGE
        ? below
        : above
  const wanted =
    align === 'center'
      ? anchor.left + anchor.width / 2 - box.width / 2
      : align === 'start'
        ? anchor.left
        : anchor.right - box.width
  const left = Math.min(Math.max(EDGE, wanted), window.innerWidth - box.width - EDGE)
  return { left, top: Math.max(EDGE, Math.min(top, window.innerHeight - box.height - EDGE)) }
}
