import { checkConditionGating, resolveObjectState, showsAt, type ConditionGating, type MapData, type MapLayer } from '@shared/maps'
import { useViewZoom } from '../space/viewZoom'
import { layerTypeOf } from './layerTypes'
import './layers'

interface Props {
  map: MapData
  layers?: MapLayer[]
  gating?: Record<string, ConditionGating>
  propGating?: Record<string, ConditionGating>
  flags?: Record<string, string | number | boolean>
}

export function LayerStack({ map, layers = map.layers, gating, propGating, flags }: Props) {
  const zoom = useViewZoom()
  return (
    <>
      {layers
        .filter((l) => {
          if (!l.visible || !showsAt(l, zoom)) return false
          if (!checkConditionGating(gating?.[l.id], flags)) return false
          if (l.kind === 'object') {
            if (!checkConditionGating(propGating?.[l.id], flags)) return false
            const state = resolveObjectState(l, flags)
            if (!state.visible) return false
          }
          return true
        })
        .map((l) => {
          const type = layerTypeOf(l)
          if (!type) return null

          const effectiveLayer =
            l.kind === 'object'
              ? (() => {
                  const state = resolveObjectState(l, flags)
                  return {
                    ...l,
                    image: state.image,
                    opacity: state.opacity,
                    collision: state.collision
                  }
                })()
              : l

          return (
            <div
              key={l.id}
              className="pointer-events-none absolute left-0 top-0"
              style={{
                transform: `translate(${effectiveLayer.offset.x}px, ${effectiveLayer.offset.y}px)`,
                opacity: typeof effectiveLayer.opacity === 'number' && effectiveLayer.opacity > 0 ? effectiveLayer.opacity : 1
              }}
            >
              <type.Layer layer={effectiveLayer as any} map={map} />
            </div>
          )
        })}
    </>
  )
}
