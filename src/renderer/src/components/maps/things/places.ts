import { Layers, MapPin } from 'lucide-react'
import { formHas, shapeBounds } from '@shared/shapes'
import { PLACE_THING, REGION_THING } from '@shared/maps'
import { placeShapes, regionShapesOf } from '../placeShapes'
import { registerMapThing, thingKey } from './registry'

registerMapThing({
  type: PLACE_THING,
  label: 'Place',
  icon: MapPin,
  rank: 10,
  things: ({ props }) =>
    props.onPick || props.onShapeMenu
      ? placeShapes(props.shapes ?? {}, props.places ?? {}).map((s) => ({
          key: thingKey(PLACE_THING, s.id),
          type: PLACE_THING,
          id: s.id,
          label: s.label,
          rank: 10,
          bounds: shapeBounds(s.form),
          hit: (p) => formHas(s.form, p),
          pick: () => props.onPick?.(s),
          menu: props.onShapeMenu && ((e) => props.onShapeMenu!(e, s))
        }))
      : []
})

registerMapThing({
  type: REGION_THING,
  label: 'Region',
  icon: Layers,
  rank: 5,
  things: ({ props }) =>
    props.onPickRegion || props.onRegionMenu
      ? regionShapesOf(props.regionShapes ?? {}, props.regions ?? {}).map((s) => ({
          key: thingKey(REGION_THING, s.id),
          type: REGION_THING,
          id: s.id,
          label: s.label,
          rank: 5,
          bounds: shapeBounds(s.form),
          hit: (p) => formHas(s.form, p),
          pick: () => props.onPickRegion?.(s),
          menu: props.onRegionMenu && ((e) => props.onRegionMenu!(e, s))
        }))
      : []
})
