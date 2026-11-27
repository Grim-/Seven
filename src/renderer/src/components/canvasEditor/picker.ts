import {
  CANVAS_Z_BANDS,
  zBandRank,
  type CanvasEntity,
  type CanvasHit,
  type CanvasLayerState,
  type ClickCycleState,
  type PickOptions,
  type Point2D,
  type Rect2D,
  type ResizeHandle
} from './types'

export function normalizeRect(a: Point2D, b: Point2D): Rect2D {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y)
  }
}

export function pointInRect(pt: Point2D, rect: Rect2D): boolean {
  return pt.x >= rect.x && pt.x <= rect.x + rect.w && pt.y >= rect.y && pt.y <= rect.y + rect.h
}

export function rectsIntersect(a: Rect2D, b: Rect2D): boolean {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y
}

export function polygonBounds(points: readonly Point2D[]): Rect2D | null {
  if (!points.length) return null
  let minX = points[0].x
  let maxX = points[0].x
  let minY = points[0].y
  let maxY = points[0].y
  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** Even-odd ray-casting point-in-polygon check. */
export function pointInPolygon(pt: Point2D, poly: readonly Point2D[]): boolean {
  if (poly.length < 3) return false
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x
    const yi = poly[i].y
    const xj = poly[j].x
    const yj = poly[j].y
    const crossesY = yi > pt.y !== yj > pt.y
    if (!crossesY) continue
    const intersectX = ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi
    if (pt.x < intersectX) inside = !inside
  }
  return inside
}

export function entityBounds(entity: CanvasEntity): Rect2D | null {
  if (entity.bounds) return entity.bounds
  if (entity.polygon?.length) return polygonBounds(entity.polygon)
  return null
}

export function buildLayerLookup(layers: readonly CanvasLayerState[]): Map<string, CanvasLayerState> {
  const map = new Map<string, CanvasLayerState>()
  for (const layer of layers) {
    map.set(layer.id, layer)
  }
  return map
}

export function isLayerInteractive(layerId: string, layerMap: ReadonlyMap<string, CanvasLayerState>): boolean {
  if (layerMap.size === 0) return true
  const layer = layerMap.get(layerId)
  if (!layer) return true
  return layer.visible && !layer.locked
}

/**
 * Strict deterministic hit sort:
 * 1. Higher Z-band rank wins (`handle 900 > actor 600 > spawner 500 > trigger 400 > prop 300 > zone 200 > region 100`)
 * 2. Higher layer order wins
 * 3. Higher zOrder within band/layer wins
 * 4. Closer raycast distance (if supplied by 3D picker) wins
 * 5. Stable ID tie-breaker
 */
export function sortCanvasHits(hits: readonly CanvasHit[]): CanvasHit[] {
  return [...hits].sort((a, b) => {
    if (a.zRank !== b.zRank) return b.zRank - a.zRank
    if (a.layerOrder !== b.layerOrder) return b.layerOrder - a.layerOrder
    if (a.zOrder !== b.zOrder) return b.zOrder - a.zOrder
    if (a.distance !== undefined && b.distance !== undefined && a.distance !== b.distance) {
      return a.distance - b.distance
    }
    return a.entityId.localeCompare(b.entityId)
  })
}

export function filterInteractiveHits(
  hits: readonly CanvasHit[],
  layers: readonly CanvasLayerState[]
): CanvasHit[] {
  const layerMap = buildLayerLookup(layers)
  return hits.filter((h) => isLayerInteractive(h.layerId, layerMap))
}

type HandlePoint = { handle: ResizeHandle; x: number; y: number }

export function rectResizeHandles(b: Rect2D): HandlePoint[] {
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  return [
    { handle: 'nw', x: b.x, y: b.y },
    { handle: 'ne', x: b.x + b.w, y: b.y },
    { handle: 'sw', x: b.x, y: b.y + b.h },
    { handle: 'se', x: b.x + b.w, y: b.y + b.h },
    { handle: 'n', x: cx, y: b.y },
    { handle: 's', x: cx, y: b.y + b.h },
    { handle: 'w', x: b.x, y: cy },
    { handle: 'e', x: b.x + b.w, y: cy }
  ]
}

/**
 * Pure 2D geometry picker implementing the Z-band contract:
 * - Corner/edge resize handles of selected entities sit in `handle` (900).
 * - Entity bodies sit in their declared band (`region 100`, `zone 200`, `prop 300`, `trigger 400`, `spawner 500`, `actor 600`).
 * - Hidden or locked layers are excluded before hits are returned.
 */
export function pickEntities2D(
  entities: readonly CanvasEntity[],
  worldPt: Point2D,
  opts: PickOptions
): CanvasHit[] {
  const layerMap = buildLayerLookup(opts.layers)
  const selectedSet = new Set(opts.selectedIds)
  const handleRadiusWorld = (opts.handleRadiusPx ?? 8) / Math.max(0.05, opts.zoom)
  const hits: CanvasHit[] = []

  for (const entity of entities) {
    if (entity.selectable === false) continue
    if (!isLayerInteractive(entity.layerId, layerMap)) continue
    if (opts.zBandFilter && !opts.zBandFilter.has(entity.zBand)) continue

    const layerOrder = layerMap.get(entity.layerId)?.order ?? 0
    const zOrder = entity.zOrder ?? 0
    const b = entityBounds(entity)

    // 1. Selected entity resize handles sit in band `handle` (900) — never blocking the interior!
    if (entity.resizable && selectedSet.has(entity.id) && b) {
      for (const hp of rectResizeHandles(b)) {
        const dx = worldPt.x - hp.x
        const dy = worldPt.y - hp.y
        if (Math.hypot(dx, dy) <= handleRadiusWorld) {
          hits.push({
            kind: 'handle',
            entityId: entity.id,
            entityKind: entity.kind,
            label: entity.label,
            layerId: entity.layerId,
            zBand: 'handle',
            zRank: CANVAS_Z_BANDS.handle,
            layerOrder,
            zOrder,
            handle: hp.handle
          })
          break
        }
      }
    }

    // 2. Entity body sits in its true Z-band (selected zone body stays at `zone` 200).
    let inside = false
    if (entity.polygon && entity.polygon.length >= 3) {
      inside = (!b || pointInRect(worldPt, b)) && pointInPolygon(worldPt, entity.polygon)
    } else if (b) {
      inside = pointInRect(worldPt, b)
    }

    if (inside) {
      hits.push({
        kind: 'entity',
        entityId: entity.id,
        entityKind: entity.kind,
        label: entity.label,
        layerId: entity.layerId,
        zBand: entity.zBand,
        zRank: zBandRank(entity.zBand),
        layerOrder,
        zOrder
      })
    }
  }

  return sortCanvasHits(hits)
}

export function pickEntitiesInBox2D(
  entities: readonly CanvasEntity[],
  worldRect: Rect2D,
  opts: PickOptions
): string[] {
  const layerMap = buildLayerLookup(opts.layers)
  const matched: CanvasHit[] = []

  for (const entity of entities) {
    if (entity.selectable === false) continue
    if (!isLayerInteractive(entity.layerId, layerMap)) continue
    if (opts.zBandFilter && !opts.zBandFilter.has(entity.zBand)) continue

    const b = entityBounds(entity)
    if (!b) continue
    if (!rectsIntersect(worldRect, b)) continue

    matched.push({
      kind: 'entity',
      entityId: entity.id,
      entityKind: entity.kind,
      label: entity.label,
      layerId: entity.layerId,
      zBand: entity.zBand,
      zRank: zBandRank(entity.zBand),
      layerOrder: layerMap.get(entity.layerId)?.order ?? 0,
      zOrder: entity.zOrder ?? 0
    })
  }

  return sortCanvasHits(matched).map((h) => h.entityId)
}

export function resolveClickCycle(
  entityHits: readonly CanvasHit[],
  prev: ClickCycleState | null,
  screenPt: Point2D,
  thresholdPx = 4
): { hit: CanvasHit | null; nextCycle: ClickCycleState | null } {
  const bodyHits = entityHits.filter((h) => h.kind === 'entity')
  if (bodyHits.length === 0) return { hit: null, nextCycle: null }

  const ids = bodyHits.map((h) => h.entityId)
  const sameSpot =
    prev !== null &&
    Math.hypot(screenPt.x - prev.screenPt.x, screenPt.y - prev.screenPt.y) <= thresholdPx &&
    prev.stackIds.length === ids.length &&
    prev.stackIds.every((id, i) => id === ids[i])

  const nextIndex = sameSpot && bodyHits.length > 1 ? (prev.index + 1) % bodyHits.length : 0
  return {
    hit: bodyHits[nextIndex],
    nextCycle: {
      screenPt,
      stackIds: ids,
      index: nextIndex
    }
  }
}

export function snapPointToGrid(pt: Point2D, gridSize: number, enabled: boolean): Point2D {
  if (!enabled || gridSize <= 1) return pt
  return {
    x: Math.round(pt.x / gridSize) * gridSize,
    y: Math.round(pt.y / gridSize) * gridSize
  }
}
