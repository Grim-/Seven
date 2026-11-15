import { engine } from '../../lib/ipc'
import { targetSources } from '../../game/targets'

targetSources.add({
  id: 'creatures',
  module: 'game',
  name: 'Creatures',
  order: 20,
  list: async ({ world }) => {
    if (!world) return []
    const save = await engine('saves.current', { world })
    return (save?.creatures ?? []).map((c) => ({
      id: `creature:${c.uid}`,
      name: c.name,
      group: 'Creatures',
      note: '',
      link: null,
      ref: { creature: c.uid },
      health: (delta: number) => engine('game.changeCreatureHealth', { world, uid: c.uid, delta })
    }))
  }
})
