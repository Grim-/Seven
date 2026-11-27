import { toId } from '@shared/ids'
import type { CopyWorldItemsResult, WorldTransferItem } from '@shared/portability'
import { PLACE_TYPE_KEY, REGION_TYPE_KEY, type WorldEntity, type WorldEntry } from '@shared/world'
import { KNOWLEDGE_SEGMENT, knowledgePart } from '@shared/worldKnowledge'
import { EVENT_SEGMENT, eventLink } from '@shared/game/worldEvents'
import { NPC_SEGMENT, npcActorId, splitNpcRef } from '@shared/worldNpcs'
import { factions } from '../factions/store'
import { freeName } from '../library/packing'
import { ToolError } from '../tools/types'
import { worldEvents } from './events'
import { knowledge } from './knowledge'
import { npcs } from './npcs'
import { worlds } from './store'

const FACTION_SEGMENT = 'faction'

const SEGMENT_ORDER: Record<string, number> = {
  [REGION_TYPE_KEY]: 1,
  [PLACE_TYPE_KEY]: 2,
  [FACTION_SEGMENT]: 3,
  [NPC_SEGMENT]: 4,
  [KNOWLEDGE_SEGMENT]: 5,
  [EVENT_SEGMENT]: 6
}

export function listWorldTransferables(worldId: string): WorldTransferItem[] {
  if (!worlds.exists(worldId)) return []
  const items: WorldTransferItem[] = []

  for (const f of factions.list(worldId, 'template')) {
    items.push({
      ref: `${worldId}/${FACTION_SEGMENT}/${f.id}`,
      segment: FACTION_SEGMENT,
      category: 'faction',
      groupLabel: 'Factions',
      key: f.id,
      title: f.name,
      subtitle: `${f.defaultStance}${f.tags.length ? ` · #${f.tags.join(' #')}` : ''}`
    })
  }

  const regions = worlds.entities(worldId, REGION_TYPE_KEY, true, 'template')
  const places = worlds.entities(worldId, PLACE_TYPE_KEY, true, 'template')

  for (const [key, r] of Object.entries(regions)) {
    const parent = typeof r.Parent === 'string' && r.Parent ? String(regions[r.Parent]?.Name || r.Parent) : ''
    const childRegions = Object.keys(regions).filter((k) => k !== key && regions[k]?.Parent === key).length
    const childPlaces = Object.keys(places).filter((k) => places[k]?.Region === key).length
    const extra = [
      childRegions ? `${childRegions} ${childRegions === 1 ? 'subregion' : 'subregions'}` : '',
      childPlaces ? `${childPlaces} ${childPlaces === 1 ? 'place' : 'places'}` : ''
    ]
      .filter(Boolean)
      .join(', ')
    items.push({
      ref: `${worldId}/${REGION_TYPE_KEY}/${key}`,
      segment: REGION_TYPE_KEY,
      category: 'region',
      groupLabel: 'Regions',
      key,
      title: String(r.Name || key),
      subtitle: [parent ? `inside ${parent}` : 'top-level region', extra].filter(Boolean).join(' · ')
    })
  }

  for (const [key, p] of Object.entries(places)) {
    const reg = typeof p.Region === 'string' && p.Region ? String(regions[p.Region]?.Name || p.Region) : ''
    const inside = typeof p.Inside === 'string' && p.Inside ? String(places[p.Inside]?.Name || p.Inside) : ''
    const children = Object.keys(places).filter((k) => k !== key && places[k]?.Inside === key).length
    items.push({
      ref: `${worldId}/${PLACE_TYPE_KEY}/${key}`,
      segment: PLACE_TYPE_KEY,
      category: 'place',
      groupLabel: 'Places',
      key,
      title: String(p.Name || key),
      subtitle:
        [reg, inside ? `in ${inside}` : '', children ? `${children} inside` : ''].filter(Boolean).join(' · ') || 'place'
    })
  }

  for (const k of knowledge.list(worldId)) {
    items.push({
      ref: knowledgePart(worldId, k.id),
      segment: KNOWLEDGE_SEGMENT,
      category: 'knowledge',
      groupLabel: 'Lore',
      key: k.id,
      title: k.name,
      subtitle: `${k.scope}${k.tags.length ? ` · #${k.tags.join(' #')}` : ''}`
    })
  }

  for (const ev of worldEvents.listDefinitions(worldId)) {
    items.push({
      ref: eventLink(worldId, ev.id),
      segment: EVENT_SEGMENT,
      category: 'event',
      groupLabel: 'Events',
      key: ev.id,
      title: ev.title,
      subtitle: `${ev.scope.level}${ev.tags.length ? ` · #${ev.tags.join(' #')}` : ''}`
    })
  }

  for (const n of npcs.list(worldId, 'template')) {
    items.push({
      ref: npcActorId(worldId, n.id),
      segment: NPC_SEGMENT,
      category: 'npc',
      groupLabel: 'Cast & NPCs',
      key: n.id,
      title: n.title,
      subtitle: [n.archetype ? 'archetype' : 'NPC', n.faction ?? ''].filter(Boolean).join(' · ')
    })
  }

  const schema = worlds.schema(worldId)
  for (const [typeKey, typeDef] of Object.entries(schema.types)) {
    const records = worlds.entities(worldId, typeKey, true, 'template')
    for (const [key, ent] of Object.entries(records)) {
      items.push({
        ref: `${worldId}/${typeKey}/${key}`,
        segment: typeKey,
        category: 'record',
        groupLabel: typeDef.plural || typeDef.label || typeKey,
        key,
        title: String(ent.Name || key),
        subtitle: typeDef.noun || typeKey
      })
    }
  }

  return items
}

function splitWorldItemRef(ref: string): { world: string; segment: string; key: string } | null {
  const clean = ref.trim().replace(/^@?world:/i, '').replace(/^"|"$/g, '')
  const [world, segment, ...rest] = clean.split('/')
  const key = rest.join('/')
  if (!world || !segment || !key) return null
  return { world, segment, key }
}

function freeKey(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${base}_${n}`
    if (!taken.has(candidate)) return candidate
  }
}

function hierarchyDepth(records: Record<string, WorldEntity>, key: string, parentField: 'Parent' | 'Inside'): number {
  let depth = 0
  let cur = key
  const seen = new Set<string>([key])
  while (depth < 64) {
    const parent = records[cur]?.[parentField]
    if (typeof parent !== 'string' || !parent || !records[parent] || seen.has(parent)) break
    seen.add(parent)
    cur = parent
    depth += 1
  }
  return depth
}

function expandHierarchy(entries: string[]): { raw: string; parts: { world: string; segment: string; key: string } | null }[] {
  const out: { raw: string; parts: { world: string; segment: string; key: string } | null }[] = []
  const seen = new Set<string>()
  const regionCache = new Map<string, Record<string, WorldEntity>>()
  const placeCache = new Map<string, Record<string, WorldEntity>>()

  const regionsOf = (worldId: string) => {
    let hit = regionCache.get(worldId)
    if (!hit) {
      hit = worlds.exists(worldId) ? worlds.entities(worldId, REGION_TYPE_KEY, true, 'template') : {}
      regionCache.set(worldId, hit)
    }
    return hit
  }

  const placesOf = (worldId: string) => {
    let hit = placeCache.get(worldId)
    if (!hit) {
      hit = worlds.exists(worldId) ? worlds.entities(worldId, PLACE_TYPE_KEY, true, 'template') : {}
      placeCache.set(worldId, hit)
    }
    return hit
  }

  const push = (world: string, segment: string, key: string, raw?: string) => {
    const id = `${world}/${segment}/${key}`
    if (seen.has(id)) return
    seen.add(id)
    out.push({ raw: raw ?? id, parts: { world, segment, key } })
  }

  const pushPlaceSubtree = (world: string, rootPlaceKey: string, raw?: string) => {
    const places = placesOf(world)
    const queue = [rootPlaceKey]
    const visited = new Set<string>([rootPlaceKey])
    let first = true
    while (queue.length) {
      const cur = queue.shift()!
      push(world, PLACE_TYPE_KEY, cur, first ? raw : undefined)
      first = false
      for (const [k, p] of Object.entries(places)) {
        if (!visited.has(k) && p.Inside === cur) {
          visited.add(k)
          queue.push(k)
        }
      }
    }
  }

  const pushRegionSubtree = (world: string, rootRegionKey: string, raw?: string) => {
    const regions = regionsOf(world)
    const places = placesOf(world)
    const collectedRegions = new Set<string>([rootRegionKey])
    const queue = [rootRegionKey]
    let first = true
    while (queue.length) {
      const cur = queue.shift()!
      push(world, REGION_TYPE_KEY, cur, first ? raw : undefined)
      first = false
      for (const [k, r] of Object.entries(regions)) {
        if (!collectedRegions.has(k) && r.Parent === cur) {
          collectedRegions.add(k)
          queue.push(k)
        }
      }
    }
    for (const [pKey, p] of Object.entries(places)) {
      if (typeof p.Region === 'string' && collectedRegions.has(p.Region)) {
        pushPlaceSubtree(world, pKey)
      }
    }
  }

  for (const raw of entries) {
    const parts = splitWorldItemRef(raw)
    if (!parts) {
      out.push({ raw, parts: null })
      continue
    }
    if (parts.segment === REGION_TYPE_KEY) {
      pushRegionSubtree(parts.world, parts.key, raw)
    } else if (parts.segment === PLACE_TYPE_KEY) {
      pushPlaceSubtree(parts.world, parts.key, raw)
    } else {
      push(parts.world, parts.segment, parts.key, raw)
    }
  }

  return out.sort((a, b) => {
    const segDiff = (SEGMENT_ORDER[a.parts?.segment ?? ''] ?? 99) - (SEGMENT_ORDER[b.parts?.segment ?? ''] ?? 99)
    if (segDiff !== 0) return segDiff
    if (a.parts?.segment === REGION_TYPE_KEY && b.parts?.segment === REGION_TYPE_KEY) {
      return hierarchyDepth(regionsOf(a.parts.world), a.parts.key, 'Parent') - hierarchyDepth(regionsOf(b.parts.world), b.parts.key, 'Parent')
    }
    if (a.parts?.segment === PLACE_TYPE_KEY && b.parts?.segment === PLACE_TYPE_KEY) {
      return hierarchyDepth(placesOf(a.parts.world), a.parts.key, 'Inside') - hierarchyDepth(placesOf(b.parts.world), b.parts.key, 'Inside')
    }
    return 0
  })
}

export function copyWorldItems(
  entries: string[],
  targetWorld: string,
  opts: { replace?: boolean } = {}
): CopyWorldItemsResult {
  if (!worlds.exists(targetWorld)) throw new ToolError(`No destination world "${targetWorld}".`)
  const replace = Boolean(opts.replace)
  const parsed = expandHierarchy(entries)

  const copied: CopyWorldItemsResult['copied'] = []
  const skipped: CopyWorldItemsResult['skipped'] = []
  const regionMap = new Map<string, string>()
  const placeMap = new Map<string, string>()
  const factionMap = new Map<string, string>()
  const npcMap = new Map<string, string>()
  const copiedPlaces: { srcWorld: string; nextKey: string; entity: WorldEntity }[] = []

  const remapActorRef = (sourceWorld: string, actorRef: string): string | null => {
    const npc = splitNpcRef(actorRef)
    if (!npc) return actorRef
    const mapped = npcMap.get(`${npc.world}/${npc.id}`)
    if (mapped) return npcActorId(targetWorld, mapped)
    if (npc.world === targetWorld) return actorRef
    if (npc.world === sourceWorld && npcs.hasTemplate(targetWorld, npc.id)) return npcActorId(targetWorld, npc.id)
    return null
  }

  for (const { raw, parts } of parsed) {
    if (!parts) {
      skipped.push({ ref: raw, reason: 'Invalid world item reference' })
      continue
    }
    const { world: srcWorld, segment, key } = parts
    if (!worlds.exists(srcWorld)) {
      skipped.push({ ref: raw, reason: `Source world "${srcWorld}" not found` })
      continue
    }

    if (segment === REGION_TYPE_KEY) {
      const src = worlds.get(srcWorld, REGION_TYPE_KEY, key, true, 'template')
      if (!src) {
        skipped.push({ ref: raw, reason: 'Region not found' })
        continue
      }
      const existing = worlds.entities(targetWorld, REGION_TYPE_KEY, true, 'template')
      const takenKeys = new Set(Object.keys(existing))
      const nextKey = replace ? key : freeKey(key, takenKeys)
      const nextName =
        !replace && nextKey !== key
          ? freeName(String(src.Name || key), (n) => Object.values(existing).some((r) => String(r.Name || '').toLowerCase() === n.toLowerCase()))
          : String(src.Name || key)
      const rawParent = typeof src.Parent === 'string' ? src.Parent : ''
      const mappedParent = rawParent ? (regionMap.get(`${srcWorld}/${rawParent}`) ?? (rawParent in existing ? rawParent : '')) : ''
      const nextEntity: WorldEntity = { ...src, Name: nextName, Parent: mappedParent }
      worlds.put(targetWorld, REGION_TYPE_KEY, nextKey, nextEntity, 'template')
      regionMap.set(`${srcWorld}/${key}`, nextKey)
      copied.push({ ref: `${targetWorld}/${REGION_TYPE_KEY}/${nextKey}`, title: nextName, segment })
      continue
    }

    if (segment === PLACE_TYPE_KEY) {
      const src = worlds.get(srcWorld, PLACE_TYPE_KEY, key, true, 'template')
      if (!src) {
        skipped.push({ ref: raw, reason: 'Place not found' })
        continue
      }
      const existingPlaces = worlds.entities(targetWorld, PLACE_TYPE_KEY, true, 'template')
      const existingRegions = worlds.entities(targetWorld, REGION_TYPE_KEY, true, 'template')
      const takenKeys = new Set(Object.keys(existingPlaces))
      const nextKey = replace ? key : freeKey(key, takenKeys)
      const nextName =
        !replace && nextKey !== key
          ? freeName(String(src.Name || key), (n) => Object.values(existingPlaces).some((p) => String(p.Name || '').toLowerCase() === n.toLowerCase()))
          : String(src.Name || key)
      const rawRegion = typeof src.Region === 'string' ? src.Region : ''
      const mappedRegion = rawRegion ? (regionMap.get(`${srcWorld}/${rawRegion}`) ?? (rawRegion in existingRegions ? rawRegion : '')) : ''
      const rawInside = typeof src.Inside === 'string' ? src.Inside : ''
      const mappedInside = rawInside ? (placeMap.get(`${srcWorld}/${rawInside}`) ?? (rawInside in existingPlaces ? rawInside : '')) : ''
      const nextEntity: WorldEntity = { ...src, Name: nextName, Region: mappedRegion, Inside: mappedInside }
      worlds.put(targetWorld, PLACE_TYPE_KEY, nextKey, nextEntity, 'template')
      placeMap.set(`${srcWorld}/${key}`, nextKey)
      copiedPlaces.push({ srcWorld, nextKey, entity: nextEntity })
      copied.push({ ref: `${targetWorld}/${PLACE_TYPE_KEY}/${nextKey}`, title: nextName, segment })
      continue
    }

    if (segment === FACTION_SEGMENT) {
      const src = factions.find(key, srcWorld, 'template')
      if (!src) {
        skipped.push({ ref: raw, reason: 'Faction not found' })
        continue
      }
      const existing = factions.list(targetWorld, 'template')
      const takenIds = new Set(existing.map((f) => f.id))
      const takenNames = new Set(existing.map((f) => f.name.toLowerCase()))
      const nextId = replace ? src.id : freeKey(src.id, takenIds)
      const nextName = !replace && (takenIds.has(src.id) || takenNames.has(src.name.toLowerCase()))
        ? freeName(src.name, (n) => takenNames.has(n.toLowerCase()))
        : src.name
      const nextLeader = src.leaderSheet ? remapActorRef(srcWorld, src.leaderSheet) : null
      const nextMembers = (src.members ?? [])
        .map((m) => remapActorRef(srcWorld, m))
        .filter((m): m is string => Boolean(m))
      const saved = factions.save(
        {
          ...src,
          id: nextId,
          name: nextName,
          leaderSheet: nextLeader ?? undefined,
          members: nextMembers
        },
        targetWorld,
        replace ? src.id : null
      )
      factionMap.set(`${srcWorld}/${src.id}`, saved.id)
      copied.push({ ref: `${targetWorld}/${FACTION_SEGMENT}/${saved.id}`, title: saved.name, segment })
      continue
    }

    if (segment === NPC_SEGMENT) {
      const src = npcs.find(key, srcWorld, 'template') ?? npcs.find(key, srcWorld, 'play')
      if (!src) {
        skipped.push({ ref: raw, reason: 'NPC not found' })
        continue
      }
      const existing = npcs.list(targetWorld, 'template')
      const existingFactions = new Set(factions.list(targetWorld, 'template').map((f) => f.id))
      const takenIds = new Set(existing.map((n) => n.id))
      const takenTitles = new Set(existing.map((n) => n.title.toLowerCase()))
      const nextId = replace ? src.id : freeKey(src.id, takenIds)
      const nextTitle = !replace && (takenIds.has(src.id) || takenTitles.has(src.title.toLowerCase()))
        ? freeName(src.title, (n) => takenTitles.has(n.toLowerCase()))
        : src.title
      const nextFaction = src.faction
        ? (factionMap.get(`${srcWorld}/${src.faction}`) ?? (existingFactions.has(src.faction) ? src.faction : null))
        : null
      const saved = npcs.saveTemplate(
        targetWorld,
        {
          ...src,
          id: nextId,
          title: nextTitle,
          faction: nextFaction
        },
        replace ? src.id : null
      )
      npcMap.set(`${srcWorld}/${src.id}`, saved.id)
      copied.push({ ref: npcActorId(targetWorld, saved.id), title: saved.title, segment })
      continue
    }

    if (segment === KNOWLEDGE_SEGMENT) {
      const src = knowledge.find(srcWorld, key)
      if (!src) {
        skipped.push({ ref: raw, reason: 'Lore entry not found' })
        continue
      }
      const existing = knowledge.list(targetWorld)
      const takenIds = new Set(existing.map((k) => k.id))
      const takenNames = new Set(existing.map((k) => k.name.toLowerCase()))
      const nextId = replace ? src.id : freeKey(src.id, takenIds)
      const nextName = !replace && (takenIds.has(src.id) || takenNames.has(src.name.toLowerCase()))
        ? freeName(src.name, (n) => takenNames.has(n.toLowerCase()))
        : src.name
      const saved = knowledge.save(targetWorld, { ...src, id: nextId, name: nextName }, replace ? src.id : null)
      copied.push({ ref: knowledgePart(targetWorld, saved.id), title: saved.name, segment })
      continue
    }

    if (segment === EVENT_SEGMENT) {
      const src = worldEvents.find(key, srcWorld)
      if (!src) {
        skipped.push({ ref: raw, reason: 'World event not found' })
        continue
      }
      const existing = worldEvents.listDefinitions(targetWorld)
      const takenIds = new Set(existing.map((e) => e.id))
      const takenTitles = new Set(existing.map((e) => e.title.toLowerCase()))
      const nextId = replace ? src.id : freeKey(src.id, takenIds)
      const nextTitle = !replace && (takenIds.has(src.id) || takenTitles.has(src.title.toLowerCase()))
        ? freeName(src.title, (n) => takenTitles.has(n.toLowerCase()))
        : src.title
      const nextScope =
        src.scope.level === 'place' && src.scope.refId
          ? {
              ...src.scope,
              refId: `${targetWorld}/${placeMap.get(`${srcWorld}/${src.scope.refId.split('/').pop() ?? ''}`) ?? (src.scope.refId.split('/').pop() ?? '')}`
            }
          : src.scope.level === 'area' && src.scope.refId
            ? {
                ...src.scope,
                refId: `${targetWorld}/${regionMap.get(`${srcWorld}/${src.scope.refId.split('/').pop() ?? ''}`) ?? (src.scope.refId.split('/').pop() ?? '')}`
              }
            : src.scope
      const saved = worldEvents.save(
        {
          ...src,
          id: nextId,
          title: nextTitle,
          worldId: targetWorld,
          scope: nextScope
        },
        replace ? src.id : null
      )
      copied.push({ ref: eventLink(targetWorld, saved.id), title: saved.title, segment })
      continue
    }

    // Custom schema record: ensure the type definition exists on the target world first
    const srcSchema = worlds.schema(srcWorld)
    const srcType = srcSchema.types[segment]
    if (!srcType) {
      skipped.push({ ref: raw, reason: `Unknown type "${segment}" in ${srcWorld}` })
      continue
    }
    const ent = worlds.get(srcWorld, segment, key, true, 'template')
    if (!ent) {
      skipped.push({ ref: raw, reason: 'Record not found' })
      continue
    }
    const targetSchema = worlds.schema(targetWorld)
    if (!targetSchema.types[segment]) {
      worlds.saveSchema(targetWorld, {
        ...targetSchema,
        types: { ...targetSchema.types, [segment]: srcType }
      })
    }
    const existing = worlds.entities(targetWorld, segment, true, 'template')
    const takenKeys = new Set(Object.keys(existing))
    const nextKey = replace ? key : freeKey(toId(key) || key, takenKeys)
    const nextName =
      !replace && nextKey !== key
        ? freeName(String(ent.Name || key), (n) => Object.values(existing).some((r) => String(r.Name || '').toLowerCase() === n.toLowerCase()))
        : String(ent.Name || key)
    worlds.put(targetWorld, segment, nextKey, { ...ent, Name: nextName }, 'template')
    copied.push({ ref: `${targetWorld}/${segment}/${nextKey}`, title: nextName, segment })
  }

  if (copiedPlaces.length > 0) {
    const targetPlaces = worlds.entities(targetWorld, PLACE_TYPE_KEY, true, 'template')
    for (const { srcWorld, nextKey, entity } of copiedPlaces) {
      if (!Array.isArray(entity.Exits) || entity.Exits.length === 0) continue
      let changed = false
      const remappedExits = (entity.Exits as WorldEntry[]).map((exit) => {
        if (!exit || typeof exit !== 'object' || !exit.ref) return exit
        const nextRef = placeMap.get(`${srcWorld}/${exit.ref}`) ?? (exit.ref in targetPlaces ? exit.ref : null)
        if (nextRef !== exit.ref) changed = true
        return nextRef !== exit.ref ? { ...exit, ref: nextRef } : exit
      })
      if (changed) {
        worlds.put(targetWorld, PLACE_TYPE_KEY, nextKey, { ...entity, Exits: remappedExits }, 'template')
      }
    }
  }

  return { copied, skipped }
}
