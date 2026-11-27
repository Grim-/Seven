import { cleanMap, mapObjects, type MapLayer } from '@shared/maps'
import { componentClass, type ParamSchema, type ParamSpec } from '@shared/game/core'
import { defId, type DefType, type GameDef } from '@shared/game/defs'
import { PLACE_TYPE_KEY, REGION_TYPE_KEY, type WorldEntity, type WorldLaunch, type WorldPost, type WorldSchema } from '@shared/world'
import { refsIn } from '@shared/story'
import type { EntryRef, Packing, Unpack } from '../library/packing'
import { freeName } from '../library/packing'
import { cleanCard, cleanSet } from '../../modules/cards/clean'
import { readDeckData } from '../cards/decks'
import { data } from '../data/hub'
import { agentAccess } from '../agents/access'
import { maps } from '../maps/store'
import { worlds } from '../worlds/store'
import { knowledge } from '../worlds/knowledge'
import type { WorldKnowledge } from '@shared/worldKnowledge'
import { worldEvents } from '../worlds/events'
import type { WorldEvent } from '@shared/game/worldEvents'
import { factions } from '../factions/store'
import type { StoredFaction } from '@shared/game/factions'
import { npcs } from '../worlds/npcs'
import { NPC_SEGMENT, npcActorId, splitNpcRef, type WorldNpc } from '@shared/worldNpcs'
import { saves } from '../worlds/saves'
import { tags as tagStore } from '../library/tags'
import { pageKindOf as pageKindForType, type AgentProfile } from '@shared/types'
import { noteFailure } from '../util/report'

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v))

function pushRef(out: EntryRef[], seen: Set<string>, kind: string | null | undefined, id: unknown): void {
  if (!kind || typeof id !== 'string') return
  const clean = id.trim()
  if (!clean || clean.startsWith('data:')) return
  const key = `${kind}/${clean}`
  if (seen.has(key)) return
  seen.add(key)
  out.push({ kind, id: clean })
}

function pageKindOfType(id: string): string | null {
  const meta = data.pages.metaFor(id)
  if (!meta?.type) return null
  return pageKindForType(meta.type)
}

const COMP_TYPE_TO_TEMPLATE_KIND: Record<string, string> = {
  character_class: 'game_class',
  trait: 'game_trait',
  ability: 'game_ability',
  item: 'game_item',
  buff: 'game_buff',
  health: 'game_stat',
  resource: 'game_stat'
}

function collectConditionRefs(conds: unknown, out: EntryRef[], seen: Set<string>): void {
  if (!Array.isArray(conds)) return
  for (const raw of conds) {
    if (!isObj(raw)) continue
    const type = typeof raw.type === 'string' ? raw.type : ''
    if (type === 'class') pushRef(out, seen, 'game_class', raw.id)
    else if (type === 'trait') pushRef(out, seen, 'game_trait', raw.id)
    else if (type === 'item') pushRef(out, seen, 'game_item', raw.id)
    else if (type === 'buff') pushRef(out, seen, 'game_buff', raw.id)
    else if (type === 'stat') pushRef(out, seen, 'game_stat', raw.id ?? raw.stat)
    else if (type === 'faction') pushRef(out, seen, 'faction', raw.id)
  }
}

function swapConditionRefs(conds: unknown, entry: Unpack['entry']): unknown {
  if (!Array.isArray(conds)) return conds
  return conds.map((raw) => {
    if (!isObj(raw)) return raw
    const type = typeof raw.type === 'string' ? raw.type : ''
    if (type === 'class' && typeof raw.id === 'string') return { ...raw, id: entry(raw.id, 'game_class') }
    if (type === 'trait' && typeof raw.id === 'string') return { ...raw, id: entry(raw.id, 'game_trait') }
    if (type === 'item' && typeof raw.id === 'string') return { ...raw, id: entry(raw.id, 'game_item') }
    if (type === 'buff' && typeof raw.id === 'string') return { ...raw, id: entry(raw.id, 'game_buff') }
    if (type === 'faction' && typeof raw.id === 'string') return { ...raw, id: entry(raw.id, 'faction') }
    if (type === 'stat' && typeof raw.id === 'string') return { ...raw, id: entry(raw.id, 'game_stat') }
    return raw
  })
}

function collectParamValueRefs(spec: ParamSpec, value: unknown, out: EntryRef[], seen: Set<string>): void {
  if (spec.kind === 'template') pushRef(out, seen, spec.templateKind, value)
  else if (spec.kind === 'entry') pushRef(out, seen, spec.entryKind, value)
  else if (spec.kind === 'storedAction') pushRef(out, seen, 'trigger_action', value)
  else if (spec.kind === 'conditions') collectConditionRefs(value, out, seen)
  else if (spec.kind === 'values' && isObj(value) && spec.templateKind) {
    for (const key of Object.keys(value)) pushRef(out, seen, spec.templateKind, key)
  } else if (spec.kind === 'list' && spec.of && Array.isArray(value)) {
    for (const item of value) collectParamValueRefs(spec.of, item, out, seen)
  } else if (spec.kind === 'classRewards' && Array.isArray(value)) {
    for (const reward of value) {
      if (!isObj(reward)) continue
      if (isObj(reward.stats)) for (const s of Object.keys(reward.stats)) pushRef(out, seen, 'game_stat', s)
      if (Array.isArray(reward.traits)) for (const t of reward.traits) pushRef(out, seen, 'game_trait', t)
      if (Array.isArray(reward.abilities)) for (const a of reward.abilities) pushRef(out, seen, 'game_ability', a)
    }
  } else if (spec.kind === 'clutchTriggers' && Array.isArray(value)) {
    for (const trig of value) {
      if (isObj(trig)) collectConditionRefs(trig.when, out, seen)
    }
  } else if (spec.kind === 'components') {
    collectComponentListRefs(value, out, seen)
  }
}

function swapParamValueRefs(spec: ParamSpec, value: unknown, entry: Unpack['entry']): unknown {
  if (spec.kind === 'template' && typeof value === 'string' && value) return spec.templateKind ? entry(value, spec.templateKind) : value
  if (spec.kind === 'entry' && typeof value === 'string' && value) return spec.entryKind ? entry(value, spec.entryKind) : value
  if (spec.kind === 'storedAction' && typeof value === 'string' && value) return entry(value, 'trigger_action')
  if (spec.kind === 'conditions') return swapConditionRefs(value, entry)
  if (spec.kind === 'values' && isObj(value) && spec.templateKind) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [entry(k, spec.templateKind!), v]))
  }
  if (spec.kind === 'list' && spec.of && Array.isArray(value)) {
    return value.map((item) => swapParamValueRefs(spec.of!, item, entry))
  }
  if (spec.kind === 'classRewards' && Array.isArray(value)) {
    return value.map((reward) => {
      if (!isObj(reward)) return reward
      return {
        ...reward,
        ...(isObj(reward.stats) ? { stats: Object.fromEntries(Object.entries(reward.stats).map(([k, v]) => [entry(k, 'game_stat'), v])) } : {}),
        ...(Array.isArray(reward.traits) ? { traits: reward.traits.map((t) => (typeof t === 'string' ? entry(t, 'game_trait') : t)) } : {}),
        ...(Array.isArray(reward.abilities) ? { abilities: reward.abilities.map((a) => (typeof a === 'string' ? entry(a, 'game_ability') : a)) } : {})
      }
    })
  }
  if (spec.kind === 'clutchTriggers' && Array.isArray(value)) {
    return value.map((trig) => (isObj(trig) ? { ...trig, when: swapConditionRefs(trig.when, entry) } : trig))
  }
  if (spec.kind === 'components') return swapComponentListRefs(value, entry)
  return value
}

export function collectComponentListRefs(list: unknown, out: EntryRef[], seen: Set<string>): void {
  if (!Array.isArray(list)) return
  for (const item of list) {
    if (!isObj(item)) continue
    const compType = typeof item.type === 'string' ? item.type : ''
    const params = isObj(item.params) ? item.params : item
    const tplKind = COMP_TYPE_TO_TEMPLATE_KIND[compType]
    if (tplKind && typeof params.id === 'string') pushRef(out, seen, tplKind, params.id)
    if (typeof params.sourceClass === 'string') pushRef(out, seen, 'game_class', params.sourceClass)
    if (typeof params.stat === 'string') pushRef(out, seen, 'game_stat', params.stat)
    if (typeof params.damageType === 'string') pushRef(out, seen, 'game_damage_type', params.damageType)
    if (typeof params.buff === 'string') pushRef(out, seen, 'game_buff', params.buff)
    if (typeof params.item === 'string') pushRef(out, seen, 'game_item', params.item)
    const Cls = componentClass(compType)
    if (Cls) {
      for (const [k, spec] of Object.entries(Cls.PARAMS)) collectParamValueRefs(spec, params[k], out, seen)
    }
    if (Array.isArray(item.comps)) collectComponentListRefs(item.comps, out, seen)
  }
}

export function swapComponentListRefs(list: unknown, entry: Unpack['entry']): unknown {
  if (!Array.isArray(list)) return list
  return list.map((item) => {
    if (!isObj(item)) return item
    const compType = typeof item.type === 'string' ? item.type : ''
    const tplKind = COMP_TYPE_TO_TEMPLATE_KIND[compType]
    const Cls = componentClass(compType)
    const swapContainer = (bag: Record<string, unknown>): Record<string, unknown> => {
      const next = { ...bag }
      if (tplKind && typeof next.id === 'string' && next.id) next.id = entry(next.id, tplKind)
      if (typeof next.sourceClass === 'string' && next.sourceClass) next.sourceClass = entry(next.sourceClass, 'game_class')
      if (typeof next.stat === 'string' && next.stat) next.stat = entry(next.stat, 'game_stat')
      if (typeof next.damageType === 'string' && next.damageType) next.damageType = entry(next.damageType, 'game_damage_type')
      if (typeof next.buff === 'string' && next.buff) next.buff = entry(next.buff, 'game_buff')
      if (typeof next.item === 'string' && next.item) next.item = entry(next.item, 'game_item')
      if (Cls) {
        for (const [k, spec] of Object.entries(Cls.PARAMS)) {
          if (k in next) next[k] = swapParamValueRefs(spec, next[k], entry)
        }
      }
      return next
    }
    const swapped = isObj(item.params) ? { ...item, params: swapContainer(item.params) } : swapContainer(item)
    return Array.isArray(swapped.comps) ? { ...swapped, comps: swapComponentListRefs(swapped.comps, entry) } : swapped
  })
}

export function gameDefUses(type: DefType, def: GameDef): EntryRef[] {
  const out: EntryRef[] = []
  const seen = new Set<string>()
  const params = type.params as ParamSchema
  for (const [k, spec] of Object.entries(params)) {
    collectParamValueRefs(spec, def.values[k], out, seen)
  }
  return out
}

export function gameDefSwap(type: DefType, def: GameDef, entry: Unpack['entry']): GameDef {
  const params = type.params as ParamSchema
  const values: Record<string, unknown> = { ...def.values }
  for (const [k, spec] of Object.entries(params)) {
    if (k in values) values[k] = swapParamValueRefs(spec, values[k], entry)
  }
  return { ...def, values }
}

export function sheetRefs(): { uses(value: unknown): EntryRef[]; swap(value: unknown, entry: Unpack['entry']): unknown } {
  return {
    uses(value: unknown): EntryRef[] {
      const out: EntryRef[] = []
      const seen = new Set<string>()
      if (!isObj(value)) return out
      if (isObj(value.mind) && typeof value.mind.reasoningStyle === 'string') pushRef(out, seen, 'style', value.mind.reasoningStyle)
      if (typeof value.faction === 'string') pushRef(out, seen, 'faction', value.faction)
      if (Array.isArray(value.relationships)) {
        for (const rel of value.relationships) {
          if (isObj(rel) && typeof rel.target === 'string' && data.pages.metaFor(rel.target)) pushRef(out, seen, 'sheet', rel.target)
        }
      }
      if (isObj(value.game)) {
        if (isObj(value.game.template) && typeof value.game.template.kind === 'string' && typeof value.game.template.id === 'string') {
          pushRef(out, seen, value.game.template.kind, value.game.template.id)
        }
        collectComponentListRefs(value.game.comps, out, seen)
      }
      return out
    },
    swap(value: unknown, entry: Unpack['entry']): unknown {
      if (!isObj(value)) return value
      const next: Record<string, unknown> = { ...value }
      if (isObj(next.mind) && typeof next.mind.reasoningStyle === 'string' && next.mind.reasoningStyle) {
        next.mind = { ...next.mind, reasoningStyle: entry(next.mind.reasoningStyle, 'style') }
      }
      if (typeof next.faction === 'string' && next.faction) next.faction = entry(next.faction, 'faction')
      if (Array.isArray(next.relationships)) {
        next.relationships = next.relationships.map((rel) =>
          isObj(rel) && typeof rel.target === 'string' && rel.target ? { ...rel, target: entry(rel.target, 'sheet') } : rel
        )
      }
      if (isObj(next.game)) {
        const tpl = isObj(next.game.template) ? next.game.template : null
        next.game = {
          ...next.game,
          ...(tpl && typeof tpl.kind === 'string' && typeof tpl.id === 'string'
            ? { template: { ...tpl, id: entry(tpl.id, tpl.kind) } }
            : {}),
          comps: swapComponentListRefs(next.game.comps, entry)
        }
      }
      return next
    }
  }
}

export function cardRefsFor(pageType: string): { uses(value: unknown): EntryRef[]; swap(value: unknown, entry: Unpack['entry']): unknown } | undefined {
  if (pageType === 'cards:card') {
    return {
      uses(value) {
        const out: EntryRef[] = []
        const seen = new Set<string>()
        try {
          const c = cleanCard(value)
          pushRef(out, seen, 'cards:layout', c.layout)
          if (c.action) {
            for (const chk of c.action.checks) {
              pushRef(out, seen, 'trigger_action', chk.passAction)
              pushRef(out, seen, 'trigger_action', chk.failAction)
            }
          }
          if (c.decision) {
            for (const opt of c.decision.options) {
              if (opt.action) pushRef(out, seen, 'trigger_action', opt.action)
            }
          }
          if (c.opposed) {
            for (const side of [c.opposed.a, c.opposed.b]) {
              if (side.sheet) pushRef(out, seen, 'sheet', side.sheet)
              if (side.action) pushRef(out, seen, 'trigger_action', side.action)
              if (side.effects?.length) collectComponentListRefs(side.effects, out, seen)
            }
          }
          if (c.gameplay) {
            pushRef(out, seen, 'trigger_action', c.gameplay.hit)
            pushRef(out, seen, 'trigger_action', c.gameplay.miss)
          }
        } catch (err) {
          noteFailure(err, 'portability', 'Could not read card dependencies')
        }
        return out
      },
      swap(value, entry) {
        if (!isObj(value)) return value
        const next: Record<string, unknown> = { ...value }
        if (typeof next.layout === 'string' && next.layout) next.layout = entry(next.layout, 'cards:layout')
        if (isObj(next.action) && Array.isArray(next.action.checks)) {
          next.action = {
            ...next.action,
            checks: next.action.checks.map((chk) =>
              isObj(chk)
                ? {
                    ...chk,
                    ...(typeof chk.passAction === 'string' && chk.passAction ? { passAction: entry(chk.passAction, 'trigger_action') } : {}),
                    ...(typeof chk.failAction === 'string' && chk.failAction ? { failAction: entry(chk.failAction, 'trigger_action') } : {})
                  }
                : chk
            )
          }
        }
        if (isObj(next.decision) && Array.isArray(next.decision.options)) {
          next.decision = {
            ...next.decision,
            options: next.decision.options.map((opt) =>
              isObj(opt) && typeof opt.action === 'string' && opt.action ? { ...opt, action: entry(opt.action, 'trigger_action') } : opt
            )
          }
        }
        if (isObj(next.opposed)) {
          const swapSide = (side: unknown) => {
            if (!isObj(side)) return side
            return {
              ...side,
              ...(typeof side.sheet === 'string' && side.sheet ? { sheet: entry(side.sheet, 'sheet') } : {}),
              ...(typeof side.action === 'string' && side.action ? { action: entry(side.action, 'trigger_action') } : {}),
              ...(Array.isArray(side.effects) ? { effects: swapComponentListRefs(side.effects, entry) } : {})
            }
          }
          next.opposed = {
            ...next.opposed,
            ...('a' in next.opposed ? { a: swapSide(next.opposed.a) } : {}),
            ...('b' in next.opposed ? { b: swapSide(next.opposed.b) } : {})
          }
        }
        if (isObj(next.gameplay)) {
          next.gameplay = {
            ...next.gameplay,
            ...(typeof next.gameplay.hit === 'string' && next.gameplay.hit ? { hit: entry(next.gameplay.hit, 'trigger_action') } : {}),
            ...(typeof next.gameplay.miss === 'string' && next.gameplay.miss ? { miss: entry(next.gameplay.miss, 'trigger_action') } : {})
          }
        }
        return next
      }
    }
  }
  if (pageType === 'cards:set') {
    return {
      uses(value) {
        const out: EntryRef[] = []
        const seen = new Set<string>()
        try {
          for (const e of cleanSet(value).cards) pushRef(out, seen, 'cards:card', e.card)
        } catch (err) {
          noteFailure(err, 'portability', 'Could not read card set dependencies')
        }
        return out
      },
      swap(value, entry) {
        if (!isObj(value) || !Array.isArray(value.cards)) return value
        return {
          ...value,
          cards: value.cards.map((e) => (isObj(e) && typeof e.card === 'string' ? { ...e, card: entry(e.card, 'cards:card') } : e))
        }
      }
    }
  }
  if (pageType === 'cards:deck') {
    return {
      uses(value) {
        const out: EntryRef[] = []
        const seen = new Set<string>()
        const d = readDeckData(value, 'Deck')
        for (const e of d.cards) pushRef(out, seen, 'cards:card', e.card)
        if (d.owner && 'character' in d.owner) pushRef(out, seen, 'sheet', d.owner.character)
        else if (d.owner && 'agent' in d.owner) pushRef(out, seen, 'agent', d.owner.agent)
        return out
      },
      swap(value, entry) {
        if (!isObj(value)) return value
        const swapList = (list: unknown) =>
          Array.isArray(list) ? list.map((e) => (isObj(e) && typeof e.card === 'string' ? { ...e, card: entry(e.card, 'cards:card') } : e)) : list
        const next: Record<string, unknown> = {
          ...value,
          ...(Array.isArray(value.cards) ? { cards: swapList(value.cards) } : {})
        }
        if (isObj(next.owner)) {
          if (typeof next.owner.character === 'string' && next.owner.character) {
            next.owner = { ...next.owner, character: entry(next.owner.character, 'sheet') }
          } else if (typeof next.owner.agent === 'string' && next.owner.agent) {
            next.owner = { ...next.owner, agent: entry(next.owner.agent, 'agent') }
          }
        }
        return next
      }
    }
  }
  return undefined
}

function collectMapLayerRefs(layers: MapLayer[], out: EntryRef[], seen: Set<string>): void {
  for (const obj of mapObjects(layers)) {
    if (obj.entry) {
      const k = pageKindOfType(obj.entry) ?? 'sheet'
      pushRef(out, seen, k, obj.entry)
    }
  }
}

function swapMapLayers(layers: MapLayer[], entry: Unpack['entry']): MapLayer[] {
  return layers.map((layer) => {
    if (layer.kind === 'group') return { ...layer, layers: swapMapLayers(layer.layers, entry) }
    if (layer.kind === 'object' && layer.entry) {
      const k = pageKindOfType(layer.entry) ?? 'sheet'
      return { ...layer, entry: entry(layer.entry, k) }
    }
    return layer
  })
}

export function mapPacking(): Packing {
  return {
    pack(id) {
      const found = maps.get(id)
      if (!found) throw new Error(`Map ${id} not found`)
      return found
    },
    uses(id) {
      const found = maps.get(id)
      if (!found) return []
      const out: EntryRef[] = []
      const seen = new Set<string>()
      collectMapLayerRefs(found.layers, out, seen)
      return out
    },
    unpack(value, how) {
      if (!isObj(value)) throw new Error('The map in this bundle is damaged')
      const base = cleanMap(value, typeof value.id === 'string' && value.id ? value.id : 'map')
      const layers = swapMapLayers(base.layers, how.entry)
      const taken = new Set(maps.list().map((m) => m.name.toLowerCase()))
      const name = how.replace ? base.name : freeName(base.name, (n) => taken.has(n.toLowerCase()))
      if (how.replace && maps.get(how.replace)) {
        return maps.save({ ...base, id: how.replace, name, layers }).id
      }
      const { id: _id, name: _n, updatedAt: _u, ...init } = base
      return maps.create(name, { ...init, layers }).id
    }
  }
}

interface WorldPack {
  name: string
  player: string | null
  rules: string
  tags: string[]
  flags: Record<string, string | number | boolean>
  launch?: WorldLaunch
  schema: WorldSchema
  entities: Record<string, Record<string, WorldEntity>>
  board: WorldPost[]
  mapUses: ReturnType<typeof worlds.mapUses>
  knowledge?: WorldKnowledge[]
  events?: WorldEvent[]
  factions?: StoredFaction[]
  npcs?: WorldNpc[]
  saves?: ReturnType<typeof saves.list>
}

export function worldPacking(): Packing {
  return {
    pack(id, opts?: Record<string, unknown>) {
      const npcRef = splitNpcRef(id)
      if (npcRef) {
        const npc = npcs.get(npcRef.id, npcRef.world, 'play')
        return { worldId: npcRef.world, segment: NPC_SEGMENT, key: npc.id, npc }
      }
      if (id.includes('/')) {
        const [w, tk, key] = id.split('/')
        const ent = worlds.get(w, tk, key, true, 'template')
        if (!ent) throw new Error(`Record ${id} not found`)
        return { worldId: w, typeKey: tk, key, name: String(ent.Name ?? key), entity: ent }
      }
      const meta = worlds.meta(id)
      const schema = worlds.schema(id)
      const entities: Record<string, Record<string, WorldEntity>> = {
        [REGION_TYPE_KEY]: worlds.entities(id, REGION_TYPE_KEY, true, 'template'),
        [PLACE_TYPE_KEY]: worlds.entities(id, PLACE_TYPE_KEY, true, 'template')
      }
      for (const typeKey of Object.keys(schema.types)) {
        entities[typeKey] = worlds.entities(id, typeKey, true, 'template')
      }
      const includeSaves = Boolean(opts?.includeSaves)
      const pack: WorldPack = {
        name: meta.name,
        player: meta.player ?? null,
        rules: meta.rules ?? '',
        tags: meta.tags ?? [],
        flags: meta.flags ?? {},
        ...(meta.launch ? { launch: meta.launch } : {}),
        schema,
        entities,
        board: worlds.board(id),
        mapUses: worlds.mapUses(id),
        knowledge: knowledge.list(id),
        events: worldEvents.listDefinitions(id),
        factions: factions.list(id, 'template'),
        npcs: npcs.list(id, 'template'),
        ...(includeSaves ? { saves: saves.list().filter((s) => s.world === id) } : {})
      }
      return pack
    },
    uses(id) {
      const npcRef = splitNpcRef(id)
      if (npcRef) {
        const out: EntryRef[] = []
        const seen = new Set<string>()
        const npc = npcs.find(npcRef.id, npcRef.world, 'play')
        if (npc?.image) pushRef(out, seen, 'asset', npc.image)
        if (npc?.lootTableId) pushRef(out, seen, 'loot_table', npc.lootTableId)
        for (const val of Object.values(npc?.values ?? {})) {
          for (const r of refsIn(val)) {
            if (r.kind === 'repo' || r.kind === 'page') pushRef(out, seen, r.kind, r.ref)
          }
        }
        return out
      }
      if (id.includes('/')) return []
      const out: EntryRef[] = []
      const seen = new Set<string>()
      const meta = worlds.meta(id)
      if (meta.player && !splitNpcRef(meta.player)) pushRef(out, seen, 'sheet', meta.player)
      if (meta.launch?.startingMap) pushRef(out, seen, 'map', meta.launch.startingMap)
      for (const aId of meta.launch?.openingActionIds ?? []) pushRef(out, seen, 'trigger_action', aId)
      for (const p of Object.values(worlds.entities(id, PLACE_TYPE_KEY, true, 'template'))) {
        if (typeof p.Files === 'string') {
          for (const r of refsIn(p.Files)) {
            if (r.kind === 'sheet' || r.kind === 'page' || r.kind === 'agent') pushRef(out, seen, r.kind, r.ref)
          }
        }
      }
      for (const npc of npcs.list(id, 'template')) {
        if (npc.image) pushRef(out, seen, 'asset', npc.image)
        if (npc.lootTableId) pushRef(out, seen, 'loot_table', npc.lootTableId)
        for (const val of Object.values(npc.values)) {
          for (const r of refsIn(val)) {
            if (r.kind === 'repo' || r.kind === 'page') pushRef(out, seen, r.kind, r.ref)
          }
        }
      }
      for (const u of worlds.mapUses(id)) {
        pushRef(out, seen, 'map', u.map)
        for (const sId of Object.keys(u.stand ?? {})) {
          if (!splitNpcRef(sId)) pushRef(out, seen, 'sheet', sId)
        }
        for (const trig of u.triggers ?? []) {
          collectComponentListRefs(trig.comps, out, seen)
        }
      }
      return out
    },
    unpack(value, how) {
      if (!isObj(value)) throw new Error('The world in this bundle is damaged')
      if (value.segment === NPC_SEGMENT && isObj(value.npc)) {
        const targetWorld = how.replace?.split('/')[0] ?? worlds.list()[0]?.id
        if (!targetWorld) throw new Error('Create or select a world first to import a world NPC.')
        const rawNpc = value.npc as Record<string, unknown>
        const image = typeof rawNpc.image === 'string' && rawNpc.image ? how.entry(rawNpc.image, 'asset') : null
        const saved = npcs.saveTemplate(targetWorld, { ...rawNpc, image })
        return npcActorId(targetWorld, saved.id)
      }
      if (typeof value.typeKey === 'string' && typeof value.key === 'string' && isObj(value.entity)) {
        const targetWorld = how.replace?.split('/')[0] ?? worlds.list()[0]?.id
        if (!targetWorld) throw new Error('Create or select a world first to import a single world record.')
        worlds.put(targetWorld, value.typeKey, value.key, value.entity as WorldEntity, 'template')
        return `${targetWorld}/${value.typeKey}/${value.key}`
      }
      const raw = value as unknown as WorldPack
      const taken = new Set(worlds.list().map((w) => w.name.toLowerCase()))
      const name = how.replace ? raw.name : freeName(raw.name || 'Imported World', (n) => taken.has(n.toLowerCase()))
      const target = how.replace && worlds.exists(how.replace)
        ? worlds.saveSchema(how.replace, raw.schema)
        : worlds.create(name, raw.schema)
      if (how.replace && worlds.exists(target.id)) worlds.rename(target.id, name)
      const remapActorId = (actorRef: string): string => {
        const split = splitNpcRef(actorRef)
        if (split) return npcActorId(target.id, split.id)
        return how.entry(actorRef, 'sheet')
      }
      if (raw.player) worlds.setPlayer(target.id, remapActorId(raw.player))
      if (raw.tags?.length) worlds.setTags(target.id, raw.tags)
      if (raw.flags && Object.keys(raw.flags).length) worlds.setFlags(target.id, raw.flags)
      if (raw.launch) {
        worlds.setLaunch(target.id, {
          ...raw.launch,
          startingMap: raw.launch.startingMap ? how.entry(raw.launch.startingMap, 'map') : null,
          openingActionIds: (raw.launch.openingActionIds ?? []).map((aId) => how.entry(aId, 'trigger_action'))
        })
      }
      for (const [typeKey, records] of Object.entries(raw.entities ?? {})) {
        if (!raw.schema.types[typeKey] && typeKey !== PLACE_TYPE_KEY && typeKey !== REGION_TYPE_KEY) continue
        for (const [key, ent] of Object.entries(records ?? {})) {
          if (typeKey === PLACE_TYPE_KEY && typeof ent.Files === 'string' && ent.Files) {
            const remappedFiles = ent.Files.replace(/@(sheet|page|agent):([^\s]+)/g, (_, kind: string, refId: string) => `@${kind}:${how.entry(refId, kind)}`)
            worlds.put(target.id, typeKey, key, { ...ent, Files: remappedFiles }, 'template')
          } else {
            worlds.put(target.id, typeKey, key, ent, 'template')
          }
        }
      }
      for (const k of Array.isArray(raw.knowledge) ? raw.knowledge : []) knowledge.save(target.id, k)
      for (const npc of Array.isArray(raw.npcs) ? raw.npcs : []) {
        npcs.saveTemplate(target.id, {
          ...npc,
          image: npc.image ? how.entry(npc.image, 'asset') : null,
          ...(npc.lootTableId ? { lootTableId: how.entry(npc.lootTableId, 'loot_table') } : {})
        })
      }
      for (const f of Array.isArray(raw.factions) ? raw.factions : []) {
        factions.save(
          {
            ...f,
            ...(f.leaderSheet ? { leaderSheet: remapActorId(f.leaderSheet) } : {}),
            ...(f.members?.length ? { members: f.members.map(remapActorId) } : {})
          },
          target.id
        )
      }
      for (const ev of Array.isArray(raw.events) ? raw.events : []) {
        worldEvents.save({
          ...ev,
          worldId: target.id,
          scope:
            ev.scope?.level === 'map' && ev.scope.refId
              ? { ...ev.scope, refId: how.entry(ev.scope.refId, 'map') }
              : ev.scope?.refId?.includes('/')
                ? { ...ev.scope, refId: `${target.id}/${ev.scope.refId.split('/').pop()}` }
                : ev.scope,
          outcomes: (ev.outcomes ?? []).map((o) => ({
            ...o,
            triggerActionIds: (o.triggerActionIds ?? []).map((aId) => how.entry(aId, 'trigger_action')),
            effects: swapComponentListRefs(o.effects ?? [], how.entry) as typeof o.effects
          }))
        })
      }
      if (Array.isArray(raw.board)) {
        for (const post of raw.board) {
          worlds.post(target.id, post.author ?? 'Unknown', post.to ?? 'ALL', post.message ?? '')
        }
      }
      if (Array.isArray(raw.mapUses)) {
        const remappedUses = raw.mapUses.map((u) => ({
          ...u,
          map: how.entry(u.map, 'map'),
          stand: Object.fromEntries(Object.entries(u.stand ?? {}).map(([sId, st]) => [remapActorId(sId), st])),
          triggers: (u.triggers ?? []).map((t) => ({
            ...t,
            comps: swapComponentListRefs(t.comps, how.entry) as typeof t.comps
          }))
        }))
        worlds.saveMapUses(target.id, remappedUses)
      }
      return target.id
    }
  }
}

export function agentPacking(): Packing {
  return {
    pack(id) {
      const a = agentAccess.get(id)
      if (!a) throw new Error(`Agent ${id} not found`)
      const { id: _id, createdAt: _c, updatedAt: _u, createdBy: _cb, private: _p, world: _w, folder: _f, workspace: _ws, ...portable } = a as AgentProfile & { world?: unknown }
      return portable
    },
    uses(id) {
      const a = agentAccess.get(id)
      if (!a) return []
      const out: EntryRef[] = []
      const seen = new Set<string>()
      pushRef(out, seen, 'theme', a.theme)
      pushRef(out, seen, 'style', a.reasoningStyle)
      if (a.sheet) pushRef(out, seen, pageKindOfType(a.sheet) ?? 'sheet', a.sheet)
      for (const s of a.sheets ?? []) pushRef(out, seen, pageKindOfType(s) ?? 'sheet', s)
      if (a.look?.avatar && a.look.avatar.kind === 'avatar') pushRef(out, seen, 'avatar', a.look.avatar.id)
      return out
    },
    unpack(value, how) {
      if (!isObj(value)) throw new Error('The agent in this bundle is damaged')
      const next: Record<string, unknown> = { ...value }
      delete next.id
      delete next.createdAt
      delete next.updatedAt
      delete next.createdBy
      delete next.private
      delete next.world
      delete next.folder
      delete next.workspace
      if (typeof next.theme === 'string' && next.theme) next.theme = how.entry(next.theme, 'theme')
      if (typeof next.reasoningStyle === 'string' && next.reasoningStyle) next.reasoningStyle = how.entry(next.reasoningStyle, 'style')
      if (typeof next.sheet === 'string' && next.sheet) next.sheet = how.entry(next.sheet, pageKindOfType(next.sheet) ?? 'sheet')
      if (Array.isArray(next.sheets)) next.sheets = next.sheets.map((s) => (typeof s === 'string' ? how.entry(s, 'sheet') : s))
      if (isObj(next.look) && isObj(next.look.avatar) && next.look.avatar.kind === 'avatar' && typeof next.look.avatar.id === 'string') {
        next.look = { ...next.look, avatar: { ...next.look.avatar, id: how.entry(next.look.avatar.id, 'avatar') } }
      }
      const rawName = typeof next.name === 'string' && next.name.trim() ? next.name.trim() : 'Imported Agent'
      const taken = new Set(agentAccess.list().map((a) => a.name.toLowerCase()))
      const name = how.replace ? rawName : freeName(rawName, (n) => taken.has(n.toLowerCase()))
      return agentAccess.save({ ...(next as Record<string, unknown>), ...(how.replace ? { id: how.replace } : {}), name } as unknown as Parameters<typeof agentAccess.save>[0]).id
    }
  }
}

export { defId, tagStore }
