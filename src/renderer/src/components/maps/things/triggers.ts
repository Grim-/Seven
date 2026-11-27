import { Zap } from 'lucide-react'
import { formHas, shapeBounds } from '@shared/shapes'
import { TRIGGER_THING } from '@shared/maps'
import { registerMapThing, thingKey } from './registry'

registerMapThing({
  type: TRIGGER_THING,
  label: 'Trigger',
  icon: Zap,
  linkable: true,
  rank: 20,
  things: ({ props }) =>
    props.onPickTrigger || props.onTriggerMenu
      ? (props.triggers ?? []).map((t) => ({
          key: thingKey(TRIGGER_THING, t.id),
          type: TRIGGER_THING,
          id: t.id,
          label: t.name,
          rank: 20,
          bounds: shapeBounds(t.shape),
          hit: (p) => formHas(t.shape, p),
          pick: () => props.onPickTrigger?.(t),
          menu: props.onTriggerMenu && ((e) => props.onTriggerMenu!(e, t))
        }))
      : []
})
