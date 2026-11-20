import { CHARACTER_TEMPLATES, CREATURE_TEMPLATES, catalogFrom } from '@shared/game/defs'
import { GAME_BESTIARY } from '@shared/game/templateKinds'
import { registerBlueprintProvider } from '../../engine/worlds/blueprints'
import { WorldError } from '../../engine/worlds/store'
import { gameDefs } from './store'

registerBlueprintProvider({
  id: GAME_BESTIARY,
  module: 'game',
  label: 'Game creatures',
  catalog: () => catalogFrom(gameDefs.catalog()),
  has: (id) => gameDefs.list(CREATURE_TEMPLATES).some((d) => d.id === id),
  search: (query, limit) => {
    const q = query.trim().toLowerCase()
    return gameDefs
      .list(CREATURE_TEMPLATES)
      .filter((d) => !q || d.name.toLowerCase().includes(q) || d.id.includes(q))
      .slice(0, limit)
      .map((d) => ({ id: d.id, name: d.name, facts: d.notes ? [{ label: 'Notes', value: d.notes }] : [] }))
  },
  template: (id, catalog) => {
    const made = catalog.entity(CREATURE_TEMPLATES, id)
    if (!made) throw new WorldError(`There is no creature "${id}".`)
    return made
  }
})

registerBlueprintProvider({
  id: CHARACTER_TEMPLATES,
  module: 'game',
  label: 'Character templates (NPCs)',
  catalog: () => catalogFrom(gameDefs.catalog()),
  has: (id) => gameDefs.list(CHARACTER_TEMPLATES).some((d) => d.id === id),
  search: (query, limit) => {
    const q = query.trim().toLowerCase()
    return gameDefs
      .list(CHARACTER_TEMPLATES)
      .filter((d) => !q || d.name.toLowerCase().includes(q) || d.id.includes(q))
      .slice(0, limit)
      .map((d) => ({ id: d.id, name: d.name, facts: d.notes ? [{ label: 'Notes', value: d.notes }] : [] }))
  },
  template: (id, catalog) => {
    const made = catalog.entity(CHARACTER_TEMPLATES, id)
    if (!made) throw new WorldError(`There is no character template "${id}".`)
    return made
  }
})
