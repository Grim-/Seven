import { KNOWLEDGE_SEGMENT, knowledgePart, knowledgeText } from '@shared/worldKnowledge'
import { knowledge } from './knowledge'
import { registerWorldPart } from './parts'
import { worlds } from './store'

registerWorldPart(KNOWLEDGE_SEGMENT, {
  has: (world, key) => knowledge.find(world, key) !== null,
  title: (world, key) => knowledge.get(world, key).name,
  line: (world, key) => {
    const k = knowledge.get(world, key)
    return `${k.name} · ${k.scope}${k.tags.length ? ` · #${k.tags.join(' #')}` : ''}`
  },
  card: (world, key) => knowledgeText(knowledge.get(world, key), world),
  fields: (world, key) => [{ name: 'text', text: knowledge.get(world, key).text }],
  data: (world, key) => knowledge.get(world, key),
  remove: (world, key) => knowledge.remove(world, key),
  children: (world) =>
    knowledge.list(world).map((k) => ({
      kind: 'world',
      id: knowledgePart(world, k.id),
      title: k.name
    })),
  search: (world, query) => {
    const q = query.trim().toLowerCase()
    const worldName = worlds.list().find((w) => w.id === world)?.name ?? world
    return knowledge
      .list(world)
      .filter(
        (k) =>
          !q ||
          k.name.toLowerCase().includes(q) ||
          k.id.toLowerCase().includes(q) ||
          worldName.toLowerCase().includes(q) ||
          k.tags.some((t) => t.toLowerCase().includes(q))
      )
      .map((k) => ({
        kind: 'world',
        id: knowledgePart(world, k.id),
        title: k.name,
        excerpt: `knowledge in ${worldName}`,
        at: k.updatedAt
      }))
  }
})
