import { Health } from '@shared/game/components'
import { GameEntity, type Catalog, type EntityRecord } from '@shared/game/core'
import type { GameSave } from '@shared/game/save'
import type { CreatureDisposition, WorldMapUse } from '@shared/maps'
import { shapeBounds, smallestAt, type Point } from '@shared/shapes'
import { PLACE_TYPE_KEY, worldLink } from '@shared/world'
import {
  cleanSaveNpcState,
  entityRecordToNpcState,
  npcActorId,
  splitNpcRef,
  type SaveNpcState,
  type WorldNpc
} from '@shared/worldNpcs'
import { addCard, deckCards } from '../cards/decks'
import { rollText } from '../library/defs/ops'
import { ToolError } from '../tools/types'
import { blueprintCatalog, blueprintCreature, blueprintSourceOf } from './blueprints'
import { defaultCharacterGameRecord } from './defaultGame'
import { npcs } from './npcs'
import { saveInPlay } from './playLayer'
import { saves } from './saves'
import { WorldError, worlds } from './store'

export interface StampBuildContext {
  save: GameSave
  worldId: string
  where: string
  customName?: string
  faction?: string | null
  disposition?: CreatureDisposition
  lootTableId?: string | null
}

export interface ResolvedSpawnerTemplate {
  build(ctx: StampBuildContext): { npcId: string; state: SaveNpcState; sourceActorId: string | null }
}

function npcSpawnerTemplate(tpl: WorldNpc): ResolvedSpawnerTemplate {
  return {
    build(ctx) {
      const rawName = ctx.customName?.trim() ? ctx.customName.trim() : tpl.title
      const rolledTitle = rollFieldText(rawName).trim() || tpl.title
      const npcId = npcs.uniqueId(ctx.worldId, rolledTitle, Object.keys(ctx.save.npcs))
      const rolledValues: Record<string, string> = {}
      for (const [k, v] of Object.entries(tpl.values)) {
        rolledValues[k] = rollFieldText(v)
      }
      const nextStory = {
        ...tpl.story,
        where: ctx.where || rollFieldText(tpl.story.where),
        ...(tpl.story.doing ? { doing: rollFieldText(tpl.story.doing) } : {}),
        ...(tpl.story.goal ? { goal: rollFieldText(tpl.story.goal) } : {}),
        ...(tpl.story.mood ? { mood: rollFieldText(tpl.story.mood) } : {}),
        ...(tpl.story.backstorySummary ? { backstorySummary: rollFieldText(tpl.story.backstorySummary) } : {})
      }
      const nextMind = tpl.mind
        ? {
            ...tpl.mind,
            ...(tpl.mind.howItThinks ? { howItThinks: rollFieldText(tpl.mind.howItThinks) } : {}),
            ...(tpl.mind.voiceConstraints ? { voiceConstraints: rollFieldText(tpl.mind.voiceConstraints) } : {})
          }
        : null
      const nextGame: EntityRecord | null = tpl.game
        ? {
            ...structuredClone(tpl.game),
            uid: npcId,
            name: rolledTitle
          }
        : defaultCharacterGameRecord(rolledTitle, npcId)
      const state = cleanSaveNpcState({
        title: rolledTitle,
        image: tpl.image,
        fields: [...tpl.fields],
        values: rolledValues,
        dnd: tpl.dnd ? structuredClone(tpl.dnd) : null,
        game: nextGame,
        gameRules: tpl.gameRules,
        faction: ctx.faction !== undefined ? ctx.faction : tpl.faction,
        story: nextStory,
        mind: nextMind,
        relationships: structuredClone(tpl.relationships ?? []),
        sourceTemplateId: tpl.id,
        disposition: ctx.disposition ?? tpl.disposition ?? 'neutral',
        lootTableId: ctx.lootTableId !== undefined ? ctx.lootTableId : (tpl.lootTableId ?? null),
        updatedAt: Date.now()
      })
      if (!state) throw new WorldError(`Could not stamp NPC from "${tpl.title}".`)
      return {
        npcId,
        state,
        sourceActorId: npcActorId(tpl.worldId || ctx.worldId, tpl.id)
      }
    }
  }
}

function blueprintSpawnerTemplate(bpSource: string, bpId: string): ResolvedSpawnerTemplate {
  return {
    build(ctx) {
      const rawName = ctx.customName?.trim() ? rollFieldText(ctx.customName.trim()) : ''
      const record = blueprintCreature(bpSource, bpId, rawName)
      const rawCand = record.uid.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
      const npcId =
        rawCand && !npcs.hasTemplate(ctx.worldId, rawCand) && !(rawCand in ctx.save.npcs)
          ? rawCand
          : npcs.uniqueId(ctx.worldId, rawName || record.name, Object.keys(ctx.save.npcs))
      const state: SaveNpcState = entityRecordToNpcState(record.uid === npcId ? record : { ...record, uid: npcId }, {
        title: rawName || record.name,
        faction: ctx.faction ?? null,
        disposition: ctx.disposition ?? 'hostile',
        where: ctx.where,
        sourceTemplateId: bpId,
        lootTableId: ctx.lootTableId ?? null
      })
      return { npcId, state, sourceActorId: null }
    }
  }
}

export function resolveSpawnerTemplate(rawRef: string, worldId: string): ResolvedSpawnerTemplate | null {
  const trimmed = rawRef.trim()
  if (!trimmed) return null
  const split = splitNpcRef(trimmed)
  if (split) {
    const hit = npcs.find(split.id, split.world, 'template') ?? npcs.find(split.id, worldId, 'template')
    return hit ? npcSpawnerTemplate(hit) : null
  }
  if (/^@?npc:/i.test(trimmed)) {
    const clean = trimmed.replace(/^@?npc:/i, '').trim()
    const hit = npcs.find(clean, worldId, 'template')
    return hit ? npcSpawnerTemplate(hit) : null
  }
  const worldHit = worlds.exists(worldId) ? npcs.find(trimmed, worldId, 'template') : null
  if (worldHit) return npcSpawnerTemplate(worldHit)
  const bpSource = blueprintSourceOf(trimmed)
  if (bpSource) return blueprintSpawnerTemplate(bpSource, trimmed)
  return null
}

function rollFieldText(raw: string | undefined): string {
  if (!raw || !raw.trim()) return raw ?? ''
  return rollText(raw).text
}

function offsetAt(base: Point, index: number, step = 32): Point {
  if (index <= 0) return base
  const ring = Math.ceil(index / 8)
  const slot = (index - 1) % 8
  const offsets: Point[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: -1 }
  ]
  const dir = offsets[slot]
  return {
    x: Math.max(0, Math.round(base.x + dir.x * step * ring)),
    y: Math.max(0, Math.round(base.y + dir.y * step * ring))
  }
}

function placeSpawnPoint(uses: WorldMapUse[], placeKey: string, preferredMap?: string | null): { map: string; at: Point } | null {
  const ordered = preferredMap
    ? [...uses.filter((u) => u.map === preferredMap), ...uses.filter((u) => u.map !== preferredMap)]
    : uses
  for (const u of ordered) {
    const explicit = u.spawns?.[placeKey]
    if (explicit) return { map: u.map, at: explicit }
    const form = u.shapes[placeKey]
    if (form) {
      const box = shapeBounds(form)
      return { map: u.map, at: { x: Math.round(box.x + box.w / 2), y: Math.round(box.y + box.h / 2) } }
    }
  }
  if (ordered[0]) return { map: ordered[0].map, at: { x: 160, y: 160 } }
  return null
}

export interface StampSaveOptions {
  target: ResolvedSpawnerTemplate
  customName?: string
  faction?: string | null
  disposition?: CreatureDisposition
  lootTableId?: string | null
  map?: string | null
  at?: Point | null
  place?: string | null
  actions?: string
  decisions?: string
  index?: number
}

export function stampIntoSaveState(
  save: GameSave,
  uses: WorldMapUse[],
  opts: StampSaveOptions
): { save: GameSave; npcId: string; actorId: string; sourceActorId: string | null } {
  const worldId = save.world
  const idx = opts.index ?? 0

  let resolvedMap = opts.map ?? null
  let resolvedAt = opts.at ? offsetAt(opts.at, idx) : null
  let resolvedPlace = opts.place?.trim() || null

  if (!resolvedAt && resolvedPlace) {
    const spot = placeSpawnPoint(uses, resolvedPlace, resolvedMap)
    if (spot) {
      resolvedMap = spot.map
      resolvedAt = offsetAt(spot.at, idx)
    }
  }
  if (!resolvedPlace && resolvedMap && resolvedAt) {
    const use = uses.find((u) => u.map === resolvedMap)
    resolvedPlace = use ? smallestAt(use.shapes, resolvedAt) : null
  }
  const where = resolvedPlace ? worldLink(worldId, PLACE_TYPE_KEY, resolvedPlace) : ''

  const built = opts.target.build({
    save,
    worldId,
    where,
    customName: opts.customName,
    faction: opts.faction,
    disposition: opts.disposition,
    lootTableId: opts.lootTableId
  })
  const actorId = npcActorId(worldId, built.npcId)
  const nextStand =
    resolvedMap && resolvedAt
      ? {
          ...save.stand,
          [resolvedMap]: {
            ...(save.stand[resolvedMap] ?? {}),
            [actorId]: { at: resolvedAt, actions: opts.actions ?? '', decisions: opts.decisions ?? '' }
          }
        }
      : save.stand

  return {
    save: {
      ...save,
      npcs: { ...save.npcs, [built.npcId]: built.state },
      stand: nextStand
    },
    npcId: built.npcId,
    actorId,
    sourceActorId: built.sourceActorId
  }
}

export interface StampNpcsRequest {
  world: string
  target: string
  source?: string | null
  count?: number
  name?: string | null
  faction?: string | null
  disposition?: CreatureDisposition
  lootTableId?: string | null
  map?: string | null
  at?: Point | null
  place?: string | null
  actions?: string
  decisions?: string
}

export function stampNpcs(req: StampNpcsRequest): { save: GameSave; actorIds: string[]; npcIds: string[] } {
  if (!worlds.exists(req.world)) throw new WorldError(`There is no world "${req.world}".`)
  const uses = worlds.mapUses(req.world)
  const hasPlace = Boolean(req.place?.trim())
  const hasMap = Boolean(req.map?.trim())
  if (!hasPlace && !hasMap && !req.at && uses.length > 0) {
    throw new ToolError('Choose a place or map in this world where the stamped NPC(s) will exist.')
  }
  let save = saveInPlay(req.world, true)
  if (!save) throw new WorldError('This world has no save to stamp NPCs into.')

  let resolved: ResolvedSpawnerTemplate | null = null
  if (req.source === 'world-npc') {
    const hit = npcs.find(req.target, req.world, 'template') ?? npcs.find(req.target, req.world, 'play')
    if (hit) resolved = npcSpawnerTemplate(hit)
  } else if (req.source && req.source.trim()) {
    resolved = blueprintSpawnerTemplate(req.source.trim(), req.target.trim())
  } else {
    resolved = resolveSpawnerTemplate(req.target, req.world)
  }
  if (!resolved) {
    throw new ToolError(`Could not find archetype or bestiary creature "${req.target}" in "${req.world}".`)
  }

  const count = Math.max(1, Math.min(25, Math.floor(req.count ?? 1)))
  const actorIds: string[] = []
  const npcIds: string[] = []
  const deckCopies: { from: string; to: string }[] = []

  for (let i = 0; i < count; i++) {
    const stamped = stampIntoSaveState(save, uses, {
      target: resolved,
      customName: req.name ?? undefined,
      faction: req.faction,
      disposition: req.disposition,
      lootTableId: req.lootTableId,
      map: req.map,
      at: req.at,
      place: req.place,
      actions: req.actions,
      decisions: req.decisions,
      index: i
    })
    save = stamped.save
    actorIds.push(stamped.actorId)
    npcIds.push(stamped.npcId)
    if (stamped.sourceActorId) {
      deckCopies.push({ from: stamped.sourceActorId, to: stamped.actorId })
    }
  }

  const written = saves.write(save)
  for (const copy of deckCopies) {
    for (const entry of deckCards({ character: copy.from })) {
      if (entry.count > 0) addCard({ character: copy.to }, entry.card, entry.count)
    }
  }
  npcs.emit('changed', req.world)
  return { save: written, actorIds, npcIds }
}

export function isSpawnedNpcStanding(save: GameSave, spawnerRef: string, actorOrUid: string, fallbackCatalog?: Catalog | null): boolean {
  const npcId = splitNpcRef(actorOrUid)?.id ?? actorOrUid
  const state = save.npcs[npcId]
  if (state === null) return false
  const tpl = npcs.find(npcId, save.world, 'template')
  if (!state && !tpl) return false
  const record = state?.game ?? tpl?.game ?? null
  if (record) {
    const bpSource = blueprintSourceOf(spawnerRef)
    const catalog = bpSource ? blueprintCatalog(bpSource) : fallbackCatalog ?? null
    if (catalog) {
      return !GameEntity.fromRecord(record, catalog).comp(Health)?.isDead
    }
  }
  const dnd = state?.dnd ?? tpl?.dnd ?? null
  if (dnd) return dnd.hp.max <= 0 || dnd.hp.cur > 0
  return true
}
