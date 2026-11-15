import { placedKey } from '@shared/effects'
import { mapObjects } from '@shared/maps'
import { engine } from '../../lib/ipc'
import { targetSources, type PlayTarget } from '../../game/targets'

const placedTarget = (map: string, id: string, name: string, note: string): PlayTarget => ({ id: placedKey({ map, id }), name, group: 'On the map', note, link: null, ref: { placed: { map, id } } })

targetSources.add({
  id: 'placed',
  module: 'world',
  name: 'Things on the map',
  order: 30,
  list: async ({ world }) => {
    if (!world) return []
    const uses = await engine('worlds.maps', { id: world })
    const lists = await Promise.all(
      uses.map(async (use) => {
        const map = await engine('maps.get', { id: use.map })
        const things = [...(use.triggers ?? []), ...(map ? mapObjects(map.layers) : [])].filter((t) => (t.comps ?? []).length > 0)
        return things.map((t) => placedTarget(use.map, t.id, t.name, map?.name ?? use.map))
      })
    )
    return lists.flat()
  }
})
