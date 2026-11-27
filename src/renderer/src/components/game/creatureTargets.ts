import { npcActorId } from '@shared/worldNpcs'
import { engine } from '../../lib/ipc'
import { sheetTarget } from '../../game/sheetTarget'
import { targetSources } from '../../game/targets'

targetSources.add({
  id: 'creatures',
  module: 'game',
  name: 'World NPCs',
  order: 20,
  list: async ({ world }) => {
    if (!world) return []
    const list = await engine('npcs.list', { world, layer: 'play' })
    return list
      .filter((n) => !n.archetype)
      .map((n) => ({
        ...sheetTarget(npcActorId(world, n.id), n.title, '', n.image),
        group: 'World NPCs'
      }))
  }
})
