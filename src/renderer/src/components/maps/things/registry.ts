import type { MouseEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Bounds, Point } from '@shared/shapes'
import { mapThingKey, mapThingOf } from '@shared/maps'
import type { MapCanvasProps } from '../MapCanvas'

export interface MapThingSource {
  props: MapCanvasProps
  zoom: number
}

export interface MapThing {
  key: string
  type: string
  id: string
  label: string
  rank: number
  bounds: Bounds
  hit: (p: Point) => boolean
  pick: (e: MouseEvent) => void
  menu?: (e: MouseEvent) => void
}

export interface MapThingType {
  type: string
  label: string
  icon: LucideIcon
  rank: number
  linkable?: boolean
  things: (src: MapThingSource) => MapThing[]
}

const types = new Map<string, MapThingType>()

export function registerMapThing(type: MapThingType): void {
  types.set(type.type, type)
}

export function mapThingType(type: string): MapThingType | null {
  return types.get(type) ?? null
}

export function linkableThing(key: string): boolean {
  return Boolean(types.get(mapThingOf(key).type)?.linkable)
}

export function mapThingTypes(): MapThingType[] {
  return [...types.values()]
}

export const thingKey = mapThingKey
export const thingOfKey = mapThingOf

export function collectThings(src: MapThingSource): MapThing[] {
  return mapThingTypes().flatMap((t) => t.things(src))
}

const areaOf = (b: Bounds): number => b.w * b.h

export function thingsAt(things: MapThing[], p: Point): MapThing[] {
  return things.filter((t) => t.hit(p)).sort((a, b) => b.rank - a.rank || areaOf(a.bounds) - areaOf(b.bounds))
}

export function thingsIn(things: MapThing[], a: Point, b: Point): MapThing[] {
  const x0 = Math.min(a.x, b.x)
  const x1 = Math.max(a.x, b.x)
  const y0 = Math.min(a.y, b.y)
  const y1 = Math.max(a.y, b.y)
  return things.filter((t) => {
    const cx = t.bounds.x + t.bounds.w / 2
    const cy = t.bounds.y + t.bounds.h / 2
    return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1
  })
}

export function circleBounds(at: Point, r: number): Bounds {
  return { x: at.x - r, y: at.y - r, w: r * 2, h: r * 2 }
}

export const inCircle = (at: Point, r: number) => (p: Point): boolean => Math.hypot(p.x - at.x, p.y - at.y) <= r
