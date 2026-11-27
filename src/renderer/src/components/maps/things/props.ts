import { Box } from 'lucide-react'
import { checkConditionGating, childLayers, PROP_THING, resolveObjectState, showsAt, type MapLayer, type ObjectLayerData } from '@shared/maps'
import type { Bounds, Point } from '@shared/shapes'
import type { MapCanvasProps } from '../MapCanvas'
import { registerMapThing, thingKey, type MapThing } from './registry'

function shown(layer: MapLayer, props: MapCanvasProps, zoom: number): boolean {
  if (!layer.visible || !showsAt(layer, zoom) || !checkConditionGating(props.layerGating?.[layer.id], props.flags)) return false
  if (layer.kind !== 'object') return true
  return checkConditionGating(props.propGating?.[layer.id], props.flags) && resolveObjectState(layer, props.flags).visible
}

function placed(layers: MapLayer[], props: MapCanvasProps, zoom: number, at: Point): { layer: ObjectLayerData; at: Point }[] {
  return layers.filter((l) => shown(l, props, zoom)).flatMap((l) => {
    const here = { x: at.x + l.offset.x, y: at.y + l.offset.y }
    if (l.kind === 'object') return [{ layer: l, at: here }]
    return placed(childLayers(l) ?? [], props, zoom, here)
  })
}

function turnedHit(layer: ObjectLayerData, at: Point): { bounds: Bounds; hit: (p: Point) => boolean } {
  const w = layer.size.w * layer.scale
  const h = layer.size.h * layer.scale
  const c = { x: at.x + w / 2, y: at.y + h / 2 }
  const turn = (-layer.rotation * Math.PI) / 180
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  const rw = Math.abs(w * Math.cos(turn)) + Math.abs(h * Math.sin(turn))
  const rh = Math.abs(w * Math.sin(turn)) + Math.abs(h * Math.cos(turn))
  return {
    bounds: { x: c.x - rw / 2, y: c.y - rh / 2, w: rw, h: rh },
    hit: (p) => {
      const dx = p.x - c.x
      const dy = p.y - c.y
      return Math.abs(dx * cos - dy * sin) <= w / 2 && Math.abs(dx * sin + dy * cos) <= h / 2
    }
  }
}

registerMapThing({
  type: PROP_THING,
  label: 'Prop',
  icon: Box,
  linkable: true,
  rank: 30,
  things: ({ props, zoom }) => {
    const handlers = props.objects ?? {}
    if (!handlers.onPick && !handlers.onMenu) return []
    return placed(props.map.layers, props, zoom, { x: 0, y: 0 }).map(({ layer, at }): MapThing => {
      const { bounds, hit } = turnedHit(layer, at)
      return {
        key: thingKey(PROP_THING, layer.id),
        type: PROP_THING,
        id: layer.id,
        label: layer.name,
        rank: 30,
        bounds,
        hit,
        pick: (e) => handlers.onPick?.(layer, e),
        menu: handlers.onMenu && ((e) => handlers.onMenu!(layer, e))
      }
    })
  }
})
