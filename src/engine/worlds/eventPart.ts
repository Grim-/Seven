import { EVENT_SEGMENT, eventLink, eventWhere, worldEventPublicMarkdown } from '@shared/game/worldEvents'
import { worldEvents } from './events'
import { registerWorldPart } from './parts'
import { worlds } from './store'

const inWorld = (world: string, key: string) => {
  const ev = worldEvents.find(key, world)
  return ev && (!ev.worldId || ev.worldId === world) ? ev : null
}

registerWorldPart(EVENT_SEGMENT, {
  has: (world, key) => inWorld(world, key) !== null,
  title: (world, key) => worldEvents.get(key, world).title,
  line: (world, key) => {
    const e = worldEvents.get(key, world)
    return `${e.resolution ? e.resolution.outcomeLabel : e.status} · ${eventWhere(e)}`
  },
  card: (world, key) => worldEventPublicMarkdown(worldEvents.get(key, world)),
  fields: (world, key) => [{ name: 'public', text: worldEventPublicMarkdown(worldEvents.get(key, world)) }],
  data: (world, key) => worldEvents.get(key, world),
  remove: (world, key) => worldEvents.remove(key, world),
  children: (world) => worldEvents.list(world).filter((e) => e.worldId === world).map((e) => ({ kind: 'world', id: eventLink(world, e.id), title: e.title })),
  search: (world, query) => {
    const q = query.trim().toLowerCase()
    const worldName = worlds.list().find((w) => w.id === world)?.name ?? world
    return worldEvents
      .listDefinitions(world)
      .filter(
        (e) =>
          !q ||
          e.title.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          worldName.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q))
      )
      .map((e) => ({
        kind: 'world',
        id: eventLink(world, e.id),
        title: e.title,
        excerpt: `event in ${worldName}`,
        at: e.updatedAt
      }))
  }
})
