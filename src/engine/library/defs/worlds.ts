import { almanacMarkdown, formatAlmanacClock } from '@shared/almanac'
import { notFound } from '@shared/errors'
import { storedFactionText } from '@shared/game/factions'
import { storedLootTableText } from '@shared/game/lootTables'
import { storedMapObjectText } from '@shared/game/mapObjects'
import { storedTriggerActionText } from '@shared/game/triggerActions'
import { stripRef } from '@shared/ids'
import { layerNames, localPlaceMermaid, mapObjects, placePath, placeRef, placeTree, type MapData, type ObjectLayerData, type PlaceNode } from '@shared/maps'
import { smallestAt } from '@shared/shapes'
import { linkFor, splitLink } from '@shared/text'
import { pageKindOf } from '@shared/types'
import { PLACE_TYPE, PLACE_TYPE_KEY, plainValue, type WorldChange, type WorldType } from '@shared/world'
import { agentAccess } from '../../agents/access'
import { almanacs } from '../../almanac/store'
import { data } from '../../data/hub'
import { factions } from '../../factions/store'
import { worldEvents } from '../../worlds/events'
import { worldEventMetaMarkdown, worldEventPublicMarkdown } from '@shared/game/worldEvents'
import { lootTablesStore } from '../../lootTables/store'
import { mapObjectsStore } from '../../mapObjects/store'
import { maps } from '../../maps/store'
import { mapListing, removeMap } from '../../maps/usage'
import { mapPacking, worldPacking } from '../../portability/kindPackers'
import { ToolError } from '../../tools/types'
import { triggerActionsStore } from '../../triggerActions/store'
import { noteFailure } from '../../util/report'
import { secure } from '../../util/secure'
import { recall } from '../../worlds/ops'
import { whoIsHere } from '../../worlds/presence'
import { worlds } from '../../worlds/store'
import type { Exported } from '../exporters'
import { storePacking } from '../packing'
import { scoreDoc } from '../query'
import { getSheet } from '../sheets'
import { registerKind, registerKindSource } from '../kindRegistry'
import { ENTRY_WIDGET, kindRt } from './runtime'
import { accessOf, has, rollLinkActions, USER, withJson, type Kind, type KindChildInput, type KindField, type KindHit } from './types'

function worldHits(query: string, limit: number): KindHit[] {
  const trimmed = query.trim()
  const out: (KindHit & { _score: number })[] = []
  for (const w of worlds.list()) {
    const schema = worlds.schema(w.id)
    for (const tk of Object.keys(schema.types)) {
      const noun = schema.types[tk]?.noun ?? tk
      const plural = schema.types[tk]?.plural ?? tk
      for (const [key, e] of Object.entries(worlds.entities(w.id, tk, false))) {
        const id = `${w.id}/${tk}/${key}`
        if (!trimmed) {
          out.push({ kind: 'world', id, title: key, _score: 1 })
          if (out.length >= limit) return out.map(({ _score: _s, ...h }) => h)
          continue
        }
        const fields = Object.entries(e).map(([name, v]) => ({ name, value: plainValue(v) }))
        const m = scoreDoc(trimmed, { title: key, labels: ['world', noun, plural, w.name], fields })
        if (m) out.push({ kind: 'world', id, title: key, ...(m.snippet ? { excerpt: m.snippet } : {}), _score: m.score })
      }
    }
  }
  return out
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score: _s, ...h }) => h)
}

const worldLine = (w: { types: { count: number; plural: string }[] }) => w.types.map((t) => `${t.count} ${t.plural}`).join(', ')
const recordLine = (id: string) => {
  const [w, t] = id.split('/')
  return `${worlds.schema(w).types[t]?.noun ?? t} in ${worlds.meta(w).name}`
}

function recordFields(id: string): KindField[] {
  const [w, t, k] = id.split('/')
  const e = w && t && k ? worlds.get(w, t, k, false) : null
  return e ? Object.entries(e).map(([name, v]) => ({ name, text: plainValue(v) })) : []
}

function readRecord(id: string): string {
  const [worldId, type, key] = id.split('/')
  return `${worlds.meta(worldId).name}: ${recall({ worldId, type, id: key }, { type, id: key, field: null, query: null, sort: null })}`
}

function exportRecord(kind: Kind, id: string): Exported {
  const [w, t, k] = id.split('/')
  return withJson(kind, id, { world: worlds.meta(w).name, type: t, key: k, record: worlds.get(w, t, k) })
}

function removeRecord(id: string): void {
  const [w, t, k] = id.split('/')
  worlds.remove(w, t, k)
}

function mapOf(id: string): MapData {
  const found = maps.get(id)
  if (!found) throw notFound(new ToolError(`No map ${id}. find with kind map lists them.`))
  return found
}

const usedBy = (id: string) => worlds.usingMap(id).map((w) => w.name)

function worldPlaces(world: string): Record<string, Record<string, unknown>> {
  return worlds.exists(world) ? worlds.entities(world, PLACE_TYPE_KEY, false) : {}
}

const objectCenter = (o: ObjectLayerData) => ({ x: o.offset.x + (o.size.w * o.scale) / 2, y: o.offset.y + (o.size.h * o.scale) / 2 })

function placeChild(world: string, key: string, places: Record<string, Record<string, unknown>>): KindChildInput {
  return { kind: 'place', id: `${world}/${PLACE_TYPE_KEY}/${key}`, title: String(places[key]?.Name || key) }
}

function sheetChild(sheet: string): KindChildInput {
  try {
    return { kind: 'sheet', id: sheet, title: getSheet(sheet).title }
  } catch (err) {
    noteFailure(err, 'library', 'Could not read a character')
    return { kind: 'sheet', id: sheet, title: sheet }
  }
}

function mapTitle(id: string): string {
  return maps.get(id)?.name ?? id
}

const mapLine = (id: string) => {
  const m = mapOf(id)
  const used = usedBy(id)
  return `map ${m.size.w}×${m.size.h}${used.length ? `, used by ${used.join(', ')}` : ', not used by any world yet'}`
}

const clipLine = (text: string, max = 90) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

function placeSummary(places: Record<string, Record<string, unknown>>, key: string): string {
  const now = typeof places[key]?.Now === 'string' ? String(places[key].Now) : ''
  if (now.trim()) return clipLine(now)
  const inside = Object.keys(places).filter((k) => places[k]?.Inside === key).length
  return inside ? `${inside} inside` : 'nothing happening'
}

function placeLines(nodes: PlaceNode[], places: Record<string, Record<string, unknown>>, depth = 0): string[] {
  return nodes.flatMap((n) => [`${'  '.repeat(depth)}- ${n.name} (@place:${n.key}) — ${n.shaped ? placeSummary(places, n.key) : `${placeSummary(places, n.key)} (no shape on this map)`}`, ...placeLines(n.children, places, depth + 1)])
}

function changedText(c: WorldChange | undefined): string {
  if (!c) return ''
  return ` (changed by ${c.by ? (agentAccess.get(c.by)?.name ?? 'an agent') : 'the user'}, ${new Date(c.at).toLocaleString()})`
}

function placeCard(id: string): string {
  const { world, key } = placeRef(id)
  const places = worldPlaces(world)
  const p = places[key]
  if (!p) throw new ToolError(`No place ${key} in world ${world}. find with kind place lists them.`)
  const path = placePath(places, key).map((k) => String(places[k]?.Name || k))
  const changes = worlds.changes(world, PLACE_TYPE_KEY)[key] ?? {}
  const inside = Object.keys(places).filter((k) => places[k]?.Inside === key)
  const extra = Object.entries(p).filter(([k, v]) => !(k in PLACE_TYPE.fields) && v !== '' && v !== null && !(Array.isArray(v) && !v.length))
  const drawn = worlds.mapUses(world).filter((u) => u.shapes[key])
  const looks = typeof p.Looks === 'string' ? p.Looks.trim() : ''
  const mermaid = localPlaceMermaid(places, key)
  const here = (whoIsHere(world)[key] ?? []).map((v) => {
    const agent = v.agent ? agentAccess.get(v.agent) : null
    return `- ${linkFor('sheet', v.sheet)} (${v.name}) — ${v.line}${agent ? ` (played by ${linkFor('agent', agent.name)})` : ''}`
  })
  return [
    `path: ${path.join(' › ')}`,
    `world: ${worlds.meta(world).name}`,
    ...(looks ? [`looks: ${looks}`] : []),
    `files: ${String(p.Files || '').trim() || 'none'}`,
    `now: ${String(p.Now || '').trim() || 'nothing happening'}${changedText(changes.Now)}`,
    ...extra.map(([k, v]) => `${k.replace(/_/g, ' ').toLowerCase()}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v)}`),
    here.length ? `here:\n${here.join('\n')}` : 'here: nobody',
    ...(mermaid ? [`local exits (1-hop topology only):\n\`\`\`mermaid\n${mermaid}\n\`\`\``] : []),
    String(p.Actions || '').trim() ? `actions (attempts; roll one with action_check):\n${String(p.Actions).trim()}` : '',
    String(p.Decisions || '').trim() ? `decisions (choices, never rolled; when the user decides, ask them with ask_user):\n${String(p.Decisions).trim()}` : '',
    inside.length ? `inside it: ${inside.map((k) => `@place:${k}`).join(' ')}` : '',
    drawn.length ? `on maps: ${drawn.map((u) => `@map:${u.map}`).join(' ')}` : ''
  ]
    .filter(Boolean)
    .join('\n')
}

export const worldKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Worlds',
  kind: 'world',
  family: 'world',
  portability: {
    canExport: true,
    canImport: true,
    preferBundle: true,
    bundleNote: 'Game worlds bundle tilemaps, layers, records, and saves together. Archive Bundle (.sevenpack) is recommended over a single JSON or PNG Card.',
    options: [
      {
        id: 'includeSaves',
        label: 'Include play saves',
        description: 'Include active playthrough save states and character positions.',
        defaultValue: false
      }
    ]
  },
  ...worldPacking,
  label: 'World Editor',
  textParts: ['record'],
  plural: 'World Editor',
  exportable: true,
  export(id) {
    if (id.includes('/')) return exportRecord(this, id)
    const meta = worlds.meta(id)
    return withJson(this, id, { world: meta.name, schema: worlds.schema(id), types: meta.types })
  },
  icon: 'orbit',
  description: 'story worlds: each has its own kinds of records (characters, places, factions…) and a message board',
  parts: ['record'],
  title: (id) => (id.includes('/') ? (id.split('/')[2] ?? id) : (worlds.list().find((w) => w.id === id)?.name ?? id)),
  actions: ['world_recall', 'world_remember', 'world_search', 'world_post', 'world_board', 'world_create', 'world_set', 'world_entries', 'world_delete'],
  available: () => true,
  search(query, limit) {
    const q = query.toLowerCase()
    return worlds
      .list()
      .filter((w) => !q || has(w.name, q))
      .slice(0, limit)
      .map((w) => ({ kind: 'world', id: w.id, title: w.name, at: w.updatedAt }))
  },
  line: (id) => (id.includes('/') ? recordLine(id) : worldLine(worlds.meta(id))),
  fields: (id) => (id.includes('/') ? recordFields(id) : []),
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  resolve(ref) {
    const parts = ref.split('/')
    if (parts.length === 3 && worlds.exists(parts[0]) && worlds.schema(parts[0]).types[parts[1]] && worlds.entities(parts[0], parts[1], false)[parts[2]]) return ref
    const w = worlds.list().find((x) => x.id === ref || x.name.toLowerCase() === ref.toLowerCase())
    if (w) return w.id
    return worldHits(ref, 50).find((h) => h.title.toLowerCase() === ref.toLowerCase())?.id ?? null
  },
  full(id) {
    if (id.includes('/')) return readRecord(id)
    const meta = worlds.meta(id)
    return `World ${meta.name}: ${meta.types.map((t) => `${t.count} ${t.plural}`).join(', ')}. ${meta.posts} board posts.`
  },
  remove(id) {
    if (id.includes('/')) removeRecord(id)
    else worlds.delete(id)
  },
  rename(id, name) {
    if (id.includes('/')) throw new ToolError('Rename records inside their world')
    worlds.rename(id, name)
  },
  children(id) {
    if (id.includes('/')) return []
    return worlds.mapUses(id).map((u) => ({ kind: 'map', id: u.map, title: mapTitle(u.map) }))
  }
}

export const placeKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Worlds',
  kind: 'place',
  family: 'world',
  worldType: PLACE_TYPE_KEY,
  label: 'Place',
  plural: 'Places',
  icon: 'map-pin',
  description: 'places in your story worlds: where each is, what belongs there and what is happening there now',
  parts: ['record'],
  textParts: ['record'],
  actions: [],
  exportable: true,
  export: (id) => exportRecord(placeKind, id),
  available: () => (!secure.enabled || secure.unlocked) && worlds.allTypeKeys().includes(PLACE_TYPE_KEY),
  title(id) {
    const { world, key } = placeRef(id)
    try {
      return String(worldPlaces(world)[key]?.Name || key)
    } catch (err) {
      noteFailure(err, 'library', 'Could not read a world place')
      return key
    }
  },
  search(query, limit) {
    return worldHits(query, 100_000)
      .filter((h) => h.id.split('/')[1] === PLACE_TYPE_KEY)
      .slice(0, limit)
      .map((h) => ({ ...h, kind: 'place', title: this.title(h.id) }))
  },
  resolve(ref) {
    const parts = ref.split('/')
    if (parts.length === 3 && parts[1] === PLACE_TYPE_KEY && worlds.exists(parts[0])) return ref
    const key = ref.trim().toLowerCase()
    return this.search('', 100_000, USER).find((h) => h.id.split('/')[2] === key || h.title.toLowerCase() === key)?.id ?? null
  },
  line(id) {
    const { world, key } = placeRef(id)
    const places = worldPlaces(world)
    return `${placePath(places, key).map((k) => String(places[k]?.Name || k)).join(' › ')}: ${placeSummary(places, key)}`
  },
  card: placeCard,
  full: placeCard,
  fields: recordFields,
  remove(id) {
    const { world, key } = placeRef(id)
    worlds.removePlace(world, key)
  },
  children(id) {
    const { world, key } = placeRef(id)
    const places = worldPlaces(world)
    const out = Object.keys(places)
      .filter((k) => places[k]?.Inside === key)
      .map((k) => placeChild(world, k, places))
    const seen = new Set<string>()
    for (const use of worlds.mapUses(world)) {
      const m = maps.get(use.map)
      if (m) for (const o of mapObjects(m.layers)) if (smallestAt(use.shapes, objectCenter(o)) === key) out.push({ kind: 'map_object', id: `${use.map}/${o.id}`, title: o.name })
      for (const [sheet, s] of Object.entries(use.stand))
        if (!seen.has(sheet) && smallestAt(use.shapes, s.at) === key) {
          seen.add(sheet)
          out.push(sheetChild(sheet))
        }
    }
    for (const v of whoIsHere(world)[key] ?? [])
      if (!seen.has(v.sheet)) {
        seen.add(v.sheet)
        out.push({ kind: 'sheet', id: v.sheet, title: v.name })
      }
    return out
  }
}

export const mapKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Worlds',
  kind: 'map',
  ...mapPacking,
  label: 'Map Editor',
  plural: 'Map Editor',
  icon: 'map',
  description: 'maps: layers of tiles, pictures and objects that pan and zoom as one; worlds use them and draw their places on them',
  parts: [],
  actions: [],
  exportable: true,
  export(id) {
    return withJson(this, id, mapOf(id))
  },
  available: () => true,
  title(id) {
    try {
      return mapOf(id).name
    } catch (err) {
      noteFailure(err, 'library', 'Could not read a map')
      return id
    }
  },
  search(query, limit) {
    const q = query.toLowerCase()
    return mapListing()
      .map((m) => ({ kind: 'map', id: m.id, title: m.name, at: m.updatedAt }))
      .filter((h) => !q || has(h.title, q))
      .slice(0, limit)
  },
  resolve(ref) {
    const key = ref.trim().toLowerCase()
    return this.search('', 100_000, USER).find((h) => h.id === key || h.title.toLowerCase() === key)?.id ?? null
  },
  line: mapLine,
  card(id, ctx) {
    return this.full(id, {}, ctx)
  },
  full(id) {
    const m = mapOf(id)
    const places = worlds.usingMap(id).map((w) => {
      const all = worldPlaces(w.id)
      const shapes = worlds.mapUses(w.id).find((u) => u.map === id)?.shapes ?? {}
      return `Places of ${w.name} on it:\n${placeLines(placeTree(all, shapes), all).join('\n') || '(none yet)'}`
    })
    const objects = mapObjects(m.layers).map((o) =>
      [`- ${o.name}${o.entry ? ` (opens ${o.entry})` : ''}`, (o.actions ?? '').trim() ? `  actions (attempts; roll with action_check):\n${(o.actions ?? '').trim().replace(/^/gm, '    ')}` : '', (o.decisions ?? '').trim() ? `  decisions (choices, never rolled):\n${(o.decisions ?? '').trim().replace(/^/gm, '    ')}` : ''].filter(Boolean).join('\n')
    )
    return [`# ${m.name}`, `Layers: ${layerNames(m.layers).join(', ') || 'none'}.`, ...(objects.length ? [`Objects on it (generic: a door, a rock, a scroll; using one starts from there):\n${objects.join('\n')}`] : []), ...places].join('\n\n')
  },
  remove(id) {
    removeMap(id)
  },
  rename(id, name) {
    maps.save({ ...mapOf(id), name })
  },
  children(id, _ctx, trail) {
    const m = mapOf(id)
    const world = [...trail].reverse().find((t) => t.kind === 'world' && !t.id.includes('/'))?.id ?? null
    const use = world ? worlds.mapUses(world).find((u) => u.map === id) : undefined
    const shapes = use?.shapes ?? {}
    const out: KindChildInput[] = []
    if (world && use) {
      const places = worldPlaces(world)
      for (const k of Object.keys(use.shapes)) {
        const inside = places[k]?.Inside
        if (places[k] && !(typeof inside === 'string' && use.shapes[inside])) out.push(placeChild(world, k, places))
      }
      for (const [sheet, s] of Object.entries(use.stand)) if (!smallestAt(shapes, s.at)) out.push(sheetChild(sheet))
    }
    for (const o of mapObjects(m.layers)) if (!smallestAt(shapes, objectCenter(o))) out.push({ kind: 'map_object', id: `${id}/${o.id}`, title: o.name })
    return out
  }
}

function objectOf(id: string): { map: MapData; object: ObjectLayerData } {
  const [mapId, objectId] = id.split('/')
  const map = mapOf(mapId)
  const object = mapObjects(map.layers).find((o) => o.id === objectId)
  if (!object) throw notFound(new ToolError(`No object ${objectId} on map ${map.name}.`))
  return { map, object }
}

function objectText(id: string): string {
  const { map, object: o } = objectOf(id)
  return [
    `# ${o.name}`,
    `An object on @map:${map.id}${o.entry ? `; using it opens @${o.entry}` : ''}.`,
    (o.actions ?? '').trim() ? `actions (attempts; roll one with action_check):\n${(o.actions ?? '').trim()}` : '',
    (o.decisions ?? '').trim() ? `decisions (choices, never rolled; when the user decides, ask them with ask_user):\n${(o.decisions ?? '').trim()}` : ''
  ]
    .filter(Boolean)
    .join('\n')
}

export const objectKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Worlds',
  kind: 'map_object',
  ...storePacking({
    find: (id) => mapObjectsStore.list().find((o) => o.id === id) ?? null,
    names: () => mapObjectsStore.list().map((o) => o.name),
    save: ({ id, ...rest }) => mapObjectsStore.save(rest, typeof id === 'string' ? id : null),
    refs: [{ key: 'entry', kind: (id) => (data.pages.metaFor(id) ? pageKindOf(data.pages.metaFor(id)!.type) : null) }]
  }),
  image: (id) => mapObjectsStore.list().find((o) => o.id === id)?.image ?? null,
  label: 'Map object',
  plural: 'Map objects',
  icon: 'box',
  description: 'objects placed on maps: a door, a rock, a scroll, with their own actions and decisions',
  parts: [],
  actions: [],
  exportable: true,
  export(id) {
    const o = mapObjectsStore.get(id)
    return { title: o.name, markdown: storedMapObjectText(o), json: o }
  },
  available: () => true,
  search(query, limit) {
    const q = query.trim().toLowerCase()
    return mapObjectsStore
      .list()
      .filter((o) => !q || o.name.toLowerCase().includes(q) || o.tags.some((tg) => tg.toLowerCase().includes(q)))
      .slice(0, limit)
      .map((o) => ({ kind: 'map_object', id: o.id, title: o.name, at: o.updatedAt }))
  },
  resolve(ref) {
    const found = mapObjectsStore.find(ref)
    if (found) return found.id
    try {
      return objectOf(ref.trim()) && ref.trim()
    } catch (err) {
      noteFailure(err, 'library', 'Could not look up a map object')
      return null
    }
  },
  title(id) {
    try {
      const stored = mapObjectsStore.list().find((o) => o.id === id)
      if (stored) return stored.name
      return objectOf(id).object.name
    } catch (err) {
      noteFailure(err, 'library', 'Could not read a map object')
      return id
    }
  },
  line: (id) => {
    try {
      const stored = mapObjectsStore.list().find((o) => o.id === id)
      if (stored) return `${stored.collision} · ${stored.size.w}×${stored.size.h}px`
      return `object on ${objectOf(id).map.name}`
    } catch (err) {
      noteFailure(err, 'library', 'Could not read a map object')
      return 'map object'
    }
  },
  pathOf: (id, ctx) => {
    if (mapObjectsStore.list().some((o) => o.id === id)) {
      return kindRt().pathVia([[objectKind, id]], ctx)
    }
    return kindRt().pathVia([[mapKind, id.split('/')[0]], [objectKind, id]], ctx)
  },
  card(id) {
    try {
      const stored = mapObjectsStore.list().find((o) => o.id === id)
      if (stored) return storedMapObjectText(stored)
      return objectText(id)
    } catch (err) {
      noteFailure(err, 'library', 'Could not read a map object')
      return id
    }
  },
  full(id) {
    try {
      const stored = mapObjectsStore.list().find((o) => o.id === id)
      if (stored) return storedMapObjectText(stored)
      return objectText(id)
    } catch (err) {
      noteFailure(err, 'library', 'Could not read a map object')
      return id
    }
  },
  remove(id) {
    try {
      mapObjectsStore.remove(id)
    } catch (err) {
      noteFailure(err, 'library', 'Could not remove a stored map object')
    }
  },
  rename(id, name) {
    try {
      const o = mapObjectsStore.get(id)
      mapObjectsStore.save({ ...o, name })
    } catch (err) {
      noteFailure(err, 'library', 'Could not rename a stored map object')
    }
  }
}

export const factionKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Worlds',
  kind: 'faction',
  ...storePacking({
    find: (id) => factions.list().find((f) => f.id === id) ?? null,
    names: () => factions.list().map((f) => f.name),
    save: ({ id, ...rest }) => factions.save(rest, typeof id === 'string' ? id : null)
  }),
  label: 'Faction',
  plural: 'Factions',
  icon: 'flag',
  description: 'world factions, diplomatic allegiances, behavioral tenets, and hostility relations for NPCs, creatures, and the player',
  parts: [],
  actions: [],
  exportable: true,
  export(id) {
    const f = factions.get(id)
    return { title: f.name, markdown: storedFactionText(f), json: f }
  },
  available: () => true,
  search(query, limit) {
    const q = query.trim().toLowerCase()
    return factions
      .list()
      .filter((f) => !q || f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q) || f.tags.some((tg) => tg.toLowerCase().includes(q)))
      .slice(0, limit)
      .map((f) => ({ kind: 'faction', id: f.id, title: f.name, at: f.updatedAt }))
  },
  resolve(ref) {
    return factions.find(ref)?.id ?? null
  },
  line(id) {
    const f = factions.get(id)
    return `${f.name} · default: ${f.defaultStance}${f.tags.length ? ` · #${f.tags.join(' #')}` : ''}`
  },
  card(id) {
    return storedFactionText(factions.get(id))
  },
  full(id) {
    return storedFactionText(factions.get(id))
  },
  title(id) {
    try {
      return factions.get(id).name
    } catch (err) {
      noteFailure(err, 'library', 'Could not read a faction')
      return id
    }
  },
  remove(id) {
    factions.remove(id)
  },
  rename(id, name) {
    void factions.save({ ...factions.get(id), name })
  }
}

export const triggerActionKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Worlds',
  kind: 'trigger_action',
  ...storePacking({
    find: (id) => triggerActionsStore.get(id),
    names: () => triggerActionsStore.list().map((a) => a.name),
    save: ({ id, ...rest }) => triggerActionsStore.save(rest, typeof id === 'string' ? id : null)
  }),
  label: 'Trigger action',
  plural: 'Trigger actions',
  icon: 'play',
  description: 'named lists of effects (damage, items, buffs, flags, travel, fights), reused by cards, triggers and other effects',
  parts: [],
  actions: [],
  exportable: true,
  export(id) {
    const a = triggerActionsStore.get(id)
    if (!a) throw new Error(`Trigger action ${id} not found`)
    return { title: a.name, markdown: storedTriggerActionText(a), json: a }
  },
  available: () => true,
  search(query, limit) {
    const q = query.trim().toLowerCase()
    return triggerActionsStore
      .list()
      .filter((a) => !q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.tags.some((tg) => tg.toLowerCase().includes(q)))
      .slice(0, limit)
      .map((a) => ({ kind: 'trigger_action', id: a.id, title: a.name, at: a.updatedAt }))
  },
  resolve(ref) {
    return triggerActionsStore.find(ref)?.id ?? null
  },
  line(id) {
    const a = triggerActionsStore.get(id)
    if (!a) return ''
    return `${a.description}${a.tags.length ? ` · #${a.tags.join(' #')}` : ''}`
  },
  card(id) {
    const a = triggerActionsStore.get(id)
    return a ? storedTriggerActionText(a) : ''
  },
  full(id) {
    const a = triggerActionsStore.get(id)
    return a ? storedTriggerActionText(a) : ''
  },
  title(id) {
    try {
      return triggerActionsStore.get(id)?.name ?? id
    } catch (err) {
      noteFailure(err, 'library', 'Could not read a trigger action')
      return id
    }
  },
  remove(id) {
    triggerActionsStore.remove(id)
  },
  rename(id, name) {
    const a = triggerActionsStore.get(id)
    triggerActionsStore.save({ ...a, name })
  }
}

export function rollLootTable(id: string): string {
  const drop = lootTablesStore.roll(id)
  const parts: string[] = []
  if (drop.gold > 0) parts.push(`${drop.gold} Gold`)
  for (const it of drop.items) {
    const name = it.label?.trim() || data.pages.metaFor(it.itemId)?.title || it.itemId
    parts.push(`${it.quantity > 1 ? `${it.quantity}× ` : ''}${name}`)
  }
  for (const rp of drop.repoPulls) parts.push(rp.text)
  return parts.length ? parts.join(', ') : 'Nothing'
}

export const lootTableKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Worlds',
  kind: 'loot_table',
  ...storePacking({
    find: (id) => lootTablesStore.find(id),
    names: () => lootTablesStore.list().map((t) => t.name),
    save: ({ id, ...rest }) => lootTablesStore.save(rest, typeof id === 'string' ? id : null)
  }),
  label: 'Loot table',
  plural: 'Loot tables',
  icon: 'gem',
  description: 'weighted item drop tables, currency rolls, repo pulls, and cascading reward pools',
  parts: [],
  actions: [],
  exportable: true,
  export(id) {
    const t = lootTablesStore.get(id)
    return { title: t.name, markdown: storedLootTableText(t), json: t }
  },
  available: () => true,
  search(query, limit) {
    const q = query.trim().toLowerCase()
    return lootTablesStore
      .list()
      .filter((t) => !q || t.name.toLowerCase().includes(q) || t.tags.some((tg) => tg.toLowerCase().includes(q)))
      .slice(0, limit)
      .map((t) => ({ kind: 'loot_table', id: t.id, title: t.name, at: t.updatedAt }))
  },
  resolve(ref) {
    return lootTablesStore.find(ref)?.id ?? null
  },
  line(id) {
    const t = lootTablesStore.get(id)
    return `${t.entries.length} entries · ${t.rolls} roll(s)${t.tags.length ? ` · #${t.tags.join(' #')}` : ''}`
  },
  card(id) {
    return storedLootTableText(lootTablesStore.get(id))
  },
  full(id) {
    return storedLootTableText(lootTablesStore.get(id))
  },
  title(id) {
    try {
      return lootTablesStore.get(id).name
    } catch (err) {
      noteFailure(err, 'library', 'Could not read a loot table')
      return id
    }
  },
  remove(id) {
    lootTablesStore.remove(id)
  },
  rename(id, name) {
    const t = lootTablesStore.get(id)
    lootTablesStore.save({ ...t, name })
  },
  roll: (id) => rollLootTable(id),
  draw: (id, count) => Array.from({ length: count }, () => rollLootTable(id)),
  linkActions: rollLinkActions((id) => rollLootTable(id), {
    rollDetail: 'put a weighted random drop from it here',
    valueDetail: 'insert a placeholder that rolls a fresh weighted drop on submit'
  })
}

export const almanacKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  ...storePacking({
    find: (id) => {
      const a = almanacs.find(id)
      return a ? { ...a, name: a.title } : null
    },
    names: () => almanacs.list().map((a) => a.title),
    save: ({ id, name, ...rest }) => {
      const saved = almanacs.save({ ...rest, title: name }, typeof id === 'string' ? id : undefined)
      return { ...saved, name: saved.title }
    }
  }),
  uses(id) {
    const alm = almanacs.get(id)
    if (!alm) return []
    const refs: { kind: string; id: string }[] = []
    if (alm.worldId) refs.push({ kind: 'world', id: alm.worldId })
    for (const c of alm.cast) {
      const link = splitLink(c)
      if (link.kind && link.ref) refs.push({ kind: link.kind, id: stripRef(link.ref) })
    }
    return refs
  },
  kind: 'almanac',
  aliases: ['almanacs', 'campaign', 'chronicle'],
  family: 'world',
  group: 'Worlds',
  label: 'Almanac',
  plural: 'Almanacs',
  icon: 'book-open',
  description: 'top-level world-time story chronicles, active threads, and archived roleplay chats',
  parts: ['almanac'],
  textParts: ['almanac'],
  linkParts: [
    { name: 'public', description: 'public chronicle omitting secret notes (for newspapers & in-world lore)' },
    { name: 'day:', description: 'entries on a world day or range, e.g. #day:14 or #day:12-14' },
    { name: 'where:', description: 'entries at a place, e.g. #where:rust_anchorage' },
    { name: 'entry:', description: 'full drill-down & archived chat transcript of an entry, e.g. #entry:alm_1' }
  ],
  exportable: true,
  export(id) {
    const alm = almanacs.get(id)
    if (!alm) throw notFound(new ToolError(`No almanac ${id}`))
    return withJson(almanacKind, id, alm)
  },
  actions: ['find', 'read', 'show'],
  available: (ctx) => !accessOf(ctx).hidden.includes('almanac'),
  search(query, limit) {
    const q = query.toLowerCase()
    return almanacs
      .list()
      .filter(
        (a) =>
          !q ||
          has(a.title, q) ||
          has(a.id, q) ||
          a.threads.some((t) => has(t.text, q)) ||
          a.entries.some((e) => has(e.title, q) || has(e.summary, q) || has(e.where, q) || has(e.outcome, q))
      )
      .slice(0, limit)
      .map((a) => ({
        kind: 'almanac',
        id: a.id,
        title: a.title,
        tags: [],
        updatedAt: a.updatedAt,
        excerpt: `${formatAlmanacClock(a.currentTime)} · ${a.entries.length} entries · ${a.threads.filter((t) => !t.done).length} active threads`
      }))
  },
  resolve(ref) {
    return almanacs.find(stripRef(ref))?.id ?? null
  },
  line(id) {
    const a = almanacs.get(id)
    if (!a) return id
    const active = a.threads.filter((t) => (t.status ?? (t.done ? 'resolved' : 'active')) !== 'resolved').length
    return `${formatAlmanacClock(a.currentTime)} · ${a.entries.length} entries · ${active} active thread(s)`
  },
  card(id) {
    const a = almanacs.get(id)
    if (!a) throw notFound(new ToolError(`No almanac ${id}`))
    return almanacMarkdown(a)
  },
  full(id, options) {
    const a = almanacs.get(id)
    if (!a) throw notFound(new ToolError(`No almanac ${id}`))
    return almanacMarkdown(a, { part: options?.part ?? null })
  },
  fields(id) {
    const a = almanacs.get(id)
    if (!a) return []
    return [
      { name: 'public', text: almanacMarkdown(a, { part: 'public', includeSecrets: false }) },
      ...a.entries.map((e) => ({ name: e.id, text: almanacMarkdown(a, { part: `entry:${e.id}` }) }))
    ]
  },
  title(id) {
    return almanacs.get(id)?.title ?? id
  },
  remove(id) {
    almanacs.remove(id)
  },
  rename(id, title) {
    const a = almanacs.get(id)
    if (!a) throw notFound(new ToolError(`No almanac ${id}`))
    almanacs.save({ ...a, title }, a.id)
  }
}

export function nexusKinds(taken: Set<string>, claimed: Set<string>): Kind[] {
  const types = new Map<string, WorldType>()
  for (const w of worlds.list()) {
    try {
      for (const [tk, t] of Object.entries(worlds.schema(w.id).types)) if (!types.has(tk) && !claimed.has(tk)) types.set(tk, t)
    } catch (err) {
      noteFailure(err, 'library', "Could not read a world's schema")
      continue
    }
  }
  return [...types.entries()].map(([tk, t]) => {
    const kind = taken.has(tk) ? `world-${tk}` : tk
    const records = (query: string, limit: number) => worldHits(query, 100_000).filter((h) => h.id.split('/')[1] === tk).slice(0, limit).map((h) => ({ ...h, kind }))
    const k: Kind = {
      kind,
      family: 'world',
      group: 'Worlds',
      label: t.label || t.noun,
      plural: t.plural,
      icon: t.display?.icon || 'orbit',
      description: t.describe || `${t.plural.toLowerCase()} in your story worlds`,
      parts: ['record'],
      textParts: ['record'],
      exportable: true,
      export: (id) => exportRecord(k, id),
      actions: [],
      available: () => true,
      title: (id) => id.split('/')[2] ?? id,
      search: records,
      resolve(ref) {
        const parts = ref.split('/')
        if (parts.length === 3 && parts[1] === tk && worlds.exists(parts[0])) return ref
        const key = ref.trim().toLowerCase()
        return records('', 100_000).find((h) => h.title.toLowerCase() === key)?.id ?? null
      },
      line: recordLine,
      card: (id) => exportRecord(k, id).markdown,
      fields: recordFields,
      full: readRecord,
      remove: removeRecord
    }
    return k
  })
}

export const worldEventKind: Kind = {
  kind: 'world_event',
  family: 'world',
  group: 'Worlds',
  label: 'World Event',
  plural: 'World Events',
  icon: 'flame',
  description: 'Scoped world events (global, map, area, or place) with faction figureheads, diegetic rumours, and scored or player-picked TriggerAction outcomes.',
  parts: ['public', 'meta'],
  textParts: ['public', 'meta'],
  exportable: true,
  actions: [],
  available: () => true,
  search(query, limit) {
    const q = query.trim().toLowerCase()
    return worldEvents
      .list()
      .filter((e) => !q || e.title.toLowerCase().includes(q) || e.id.includes(q) || e.tags.some((t) => t.includes(q)) || e.worldId.toLowerCase().includes(q))
      .slice(0, limit)
      .map((e) => ({
        kind: 'world_event',
        id: e.id,
        title: e.title,
        line: `${e.status} · ${e.scope.level}${e.scope.refId ? `: ${e.scope.refId}` : ''}${e.worldId ? ` · ${e.worldId}` : ''}`,
        tags: e.tags
      }))
  },
  resolve(ref) {
    return worldEvents.find(stripRef(ref))?.id ?? null
  },
  line(id) {
    const e = worldEvents.find(id)
    if (!e) return id
    return `${e.status} · ${e.scope.level}${e.scope.refId ? `: ${e.scope.refId}` : ''}${e.worldId ? ` · ${e.worldId}` : ''}`
  },
  card(id) {
    return worldEventPublicMarkdown(worldEvents.get(id))
  },
  full(id, options) {
    const ev = worldEvents.get(id)
    return options?.part === 'meta' ? worldEventMetaMarkdown(ev) : worldEventPublicMarkdown(ev)
  },
  fields(id) {
    const ev = worldEvents.get(id)
    return [
      { name: 'public', text: worldEventPublicMarkdown(ev) },
      { name: 'meta', text: worldEventMetaMarkdown(ev) }
    ]
  },
  title(id) {
    return worldEvents.find(id)?.title ?? id
  },
  remove(id) {
    worldEvents.remove(id)
  },
  rename(id, title) {
    const ev = worldEvents.get(id)
    worldEvents.save({ ...ev, title }, ev.id)
  }
}

registerKind(110, worldKind, 'world')
registerKind(112, almanacKind, 'world')
registerKindSource(
  'world-types',
  115,
  (others) => nexusKinds(new Set(others.map((k) => k.kind)), new Set(others.flatMap((k) => (k.worldType ? [k.worldType] : [])))).map((kind) => ({ kind, module: 'world' })),
  true
)
registerKind(120, mapKind, 'world')
registerKind(130, placeKind, 'world')
registerKind(140, objectKind, 'world')
registerKind(150, factionKind, 'world')
registerKind(160, triggerActionKind, 'game')
registerKind(165, worldEventKind, 'world')
registerKind(170, lootTableKind, 'world')
