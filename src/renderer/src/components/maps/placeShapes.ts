import { shapeBounds, type Shape, type ShapeForm } from '@shared/shapes'
import type { WorldEntity } from '@shared/world'

export const placeName = (places: Record<string, WorldEntity>, key: string): string => {
  const name = places[key]?.Name
  return typeof name === 'string' && name ? name : key
}

const areaOf = (form: ShapeForm): number => {
  const b = shapeBounds(form)
  return b.w * b.h
}

export function placeShapes(shapes: Record<string, ShapeForm>, places: Record<string, WorldEntity>): Shape[] {
  return Object.entries(shapes)
    .sort((a, b) => areaOf(b[1]) - areaOf(a[1]))
    .map(([key, form]) => ({ id: key, label: placeName(places, key), form }))
}

export function regionShapesOf(regionShapes: Record<string, ShapeForm>, regions: Record<string, WorldEntity>): Shape[] {
  return Object.entries(regionShapes)
    .sort((a, b) => areaOf(b[1]) - areaOf(a[1]))
    .map(([key, form]) => ({ id: key, label: `Region · ${placeName(regions, key)}`, form }))
}
