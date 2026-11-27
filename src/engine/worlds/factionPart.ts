import { storedFactionText } from '@shared/game/factions'
import { factions } from '../factions/store'
import { registerWorldPart } from './parts'
import { worlds } from './store'

registerWorldPart('faction', {
  has: (world, key) => factions.find(key, world) !== null,
  title: (world, key) => factions.get(key, world, 'play').name,
  line: (world, key) => {
    const f = factions.get(key, world, 'play')
    return `${f.name} · default: ${f.defaultStance}${f.tags.length ? ` · #${f.tags.join(' #')}` : ''}`
  },
  card: (world, key) => storedFactionText(factions.get(key, world, 'play')),
  fields: (world, key) => {
    const f = factions.get(key, world, 'play')
    return [
      { name: 'description', text: f.description },
      { name: 'defaultStance', text: f.defaultStance }
    ]
  },
  data: (world, key) => factions.get(key, world, 'template'),
  remove: (world, key) => factions.remove(key, world),
  children: (world) =>
    factions.list(world, 'template').map((f) => ({
      kind: 'world',
      id: `${world}/faction/${f.id}`,
      title: f.name
    })),
  search: (world, query) => {
    const q = query.trim().toLowerCase()
    const worldName = worlds.list().find((w) => w.id === world)?.name ?? world
    return factions
      .list(world, 'template')
      .filter(
        (f) =>
          !q ||
          f.name.toLowerCase().includes(q) ||
          f.id.toLowerCase().includes(q) ||
          worldName.toLowerCase().includes(q) ||
          f.tags.some((t) => t.toLowerCase().includes(q))
      )
      .map((f) => ({
        kind: 'world',
        id: `${world}/faction/${f.id}`,
        title: f.name,
        excerpt: `faction in ${worldName}`,
        at: f.updatedAt
      }))
  }
})
