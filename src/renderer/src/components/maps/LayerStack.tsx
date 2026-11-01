import { showsAt, type MapData, type MapLayer } from '@shared/maps'
import { useViewZoom } from '../space/viewZoom'
import { layerTypeOf } from './layerTypes'
import './layers'

export function LayerStack({ map, layers = map.layers }: { map: MapData; layers?: MapLayer[] }) {
  const zoom = useViewZoom()
  return (
    <>
      {layers
        .filter((l) => l.visible && showsAt(l, zoom))
        .map((l) => {
          const type = layerTypeOf(l)
          return (
            type && (
              <div key={l.id} className="pointer-events-none absolute left-0 top-0" style={{ transform: `translate(${l.offset.x}px, ${l.offset.y}px)`, opacity: l.opacity }}>
                <type.Layer layer={l} map={map} />
              </div>
            )
          )
        })}
    </>
  )
}
