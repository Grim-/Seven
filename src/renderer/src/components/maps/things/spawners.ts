import { Skull } from 'lucide-react'
import { SPAWNER_THING } from '@shared/maps'
import { circleBounds, inCircle, registerMapThing, thingKey } from './registry'

const RADIUS = 24

registerMapThing({
  type: SPAWNER_THING,
  label: 'Spawner',
  icon: Skull,
  rank: 40,
  things: ({ props }) =>
    props.onPickSpawner || props.onSpawnerMenu
      ? (props.spawners ?? props.map.spawners ?? []).map((s) => {
          const r = RADIUS * (s.scale ?? 1)
          return {
            key: thingKey(SPAWNER_THING, s.id),
            type: SPAWNER_THING,
            id: s.id,
            label: s.name,
            rank: 40,
            bounds: circleBounds(s.at, r),
            hit: inCircle(s.at, r),
            pick: () => props.onPickSpawner?.(s),
            menu: props.onSpawnerMenu && ((e) => props.onSpawnerMenu!(s, e))
          }
        })
      : []
})
