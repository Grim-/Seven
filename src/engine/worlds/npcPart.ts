import { NPC_SEGMENT, npcActorId, npcToSheet } from '@shared/worldNpcs'
import { sheetLine, sheetMarkdownOf } from '../library/sheets'
import { npcs } from './npcs'
import { registerWorldPart } from './parts'
import { saveInPlay } from './playLayer'
import { worlds } from './store'

registerWorldPart(NPC_SEGMENT, {
  has: (world, key) => npcs.find(key, world, 'play') !== null || npcs.find(key, world, 'template') !== null,
  title: (world, key) => npcs.get(key, world, 'play').title,
  line: (world, key) => {
    const npc = npcs.get(key, world, 'play')
    const rules = worlds.exists(world) ? worlds.meta(world).rules : ''
    const base = sheetLine(npcToSheet(npc, world, rules))
    return npc.archetype ? `archetype · ${base}` : base
  },
  card: (world, key) => {
    const npc = npcs.get(key, world, 'play')
    const rules = worlds.exists(world) ? worlds.meta(world).rules : ''
    return sheetMarkdownOf(npcToSheet(npc, world, rules))
  },
  fields: (world, key) => {
    const npc = npcs.get(key, world, 'play')
    return [
      ...npc.fields.map((name) => ({ name, text: npc.values[name] ?? '' })),
      ...(npc.story.where ? [{ name: 'where', text: npc.story.where }] : []),
      ...(npc.story.doing ? [{ name: 'doing', text: npc.story.doing }] : []),
      ...(npc.story.goal ? [{ name: 'goal', text: npc.story.goal }] : []),
      ...(npc.story.mood ? [{ name: 'mood', text: npc.story.mood }] : [])
    ]
  },
  data: (world, key) => npcs.get(key, world, 'play'),
  remove: (world, key) => {
    if (npcs.hasTemplate(world, key)) npcs.removeTemplate(world, key)
    else if (saveInPlay(world, false)) npcs.removeInSave(world, key)
  },
  children: (world) =>
    npcs.list(world, 'play').map((n) => ({
      kind: 'world',
      id: npcActorId(world, n.id),
      title: n.title
    })),
  search: (world, query) => {
    const q = query.trim().toLowerCase()
    const worldName = worlds.list().find((w) => w.id === world)?.name ?? world
    return npcs
      .list(world, 'play')
      .filter(
        (n) =>
          !q ||
          n.title.toLowerCase().includes(q) ||
          n.id.toLowerCase().includes(q) ||
          worldName.toLowerCase().includes(q) ||
          (n.faction ?? '').toLowerCase().includes(q) ||
          Object.values(n.values).some((v) => v.toLowerCase().includes(q))
      )
      .map((n) => ({
        kind: 'world',
        id: npcActorId(world, n.id),
        title: n.title,
        excerpt: `${n.archetype ? 'NPC archetype' : 'NPC'} in ${worldName}`,
        at: n.updatedAt
      }))
  }
})
