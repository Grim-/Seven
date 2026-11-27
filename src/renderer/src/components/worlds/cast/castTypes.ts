import { Stats, recordHealth } from '@shared/game/components'
import { GameEntity, type Catalog } from '@shared/game/core'
import type { DndStats } from '@shared/dnd'
import type { GameSave } from '@shared/game/save'
import type { PlaceVisitor, Standing, WorldMapUse } from '@shared/maps'
import { smallestAt } from '@shared/shapes'
import type { WorldEntity } from '@shared/world'
import { actorEntry, actorLink, npcActorId, splitNpcRef, type WorldNpc } from '@shared/worldNpcs'

export type CastRoleKind = 'player' | 'party' | 'world-npc' | 'stamped' | 'character' | 'archetype'

export interface CastStatPill {
  id: string
  label: string
  value: string
  modified: boolean
}

export interface CastMember {
  actorId: string
  entry: { kind: string; id: string }
  link: string
  title: string
  image: string | null
  isWorldNpc: boolean
  npcId: string | null
  archetype: boolean
  hasTemplate: boolean
  hasOverrides: boolean
  sourceTemplateId: string | null
  roleKind: CastRoleKind
  faction: string | null
  placeKey: string | null
  regionKey: string | null
  mapId: string | null
  doing: string
  goal: string
  mood: string
  line: string
  hp: { cur: number; max: number; temp?: number } | null
  statPills: CastStatPill[]
}

const CORE_DND_ABILITY_IDS = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha'])

export function extractStatPills(
  game: WorldNpc['game'],
  catalog: Catalog | null
): CastStatPill[] {
  if (!game || !catalog) return []
  const entity = GameEntity.fromRecord(game, catalog)
  const statsComp = entity.comp(Stats)
  if (!statsComp) {
    entity.stop()
    return []
  }
  const pills: CastStatPill[] = []
  for (const def of catalog.stats()) {
    if (def.domain === 'resource') continue
    const val = Math.round(statsComp.value(def.id) * 100) / 100
    const modified = val !== def.default
    const isCustomStat = !CORE_DND_ABILITY_IDS.has(def.id.toLowerCase())
    if (!isCustomStat && !modified) continue
    pills.push({
      id: def.id,
      label: def.label,
      value: `${val}`,
      modified
    })
  }
  entity.stop()
  return pills.slice(0, 6)
}

function parseWherePlace(where: string | undefined, worldId: string): string | null {
  if (!where) return null
  const m = /^@world:([^/#\s]+)\/place\/([^#\s]+)$/i.exec(where.trim())
  if (m && m[1] === worldId) return m[2]
  const legacy = /^@place:([^#\s]+)$/i.exec(where.trim())
  return legacy ? legacy[1] : null
}

function roleLabelOrder(role: CastRoleKind): number {
  const ranks: Record<CastRoleKind, number> = {
    player: 0,
    party: 1,
    'world-npc': 2,
    character: 3,
    stamped: 4,
    archetype: 5
  }
  return ranks[role]
}

export const CAST_ROLE_LABELS: Record<CastRoleKind, string> = {
  player: 'Protagonist',
  party: 'Party',
  'world-npc': 'World NPC',
  character: 'Character',
  stamped: 'Stamped',
  archetype: 'Archetype'
}

export function buildWorldCast(opts: {
  worldId: string
  playerSheet: string | null
  templateNpcs: WorldNpc[]
  playNpcs: WorldNpc[]
  visitors: PlaceVisitor[]
  standingMap: Map<string, { mapId: string; use: WorldMapUse; standing: Standing }>
  places: Record<string, WorldEntity>
  save: GameSave | null
  layer: 'play' | 'template'
  catalog: Catalog | null
}): CastMember[] {
  const {
    worldId,
    playerSheet,
    templateNpcs,
    playNpcs,
    visitors,
    standingMap,
    places,
    save,
    layer,
    catalog
  } = opts
  const templateIds = new Set(templateNpcs.map((n) => n.id))
  const partySet = new Set(save?.party ?? [])
  const activeNpcs = layer === 'template' ? templateNpcs : playNpcs
  const out: CastMember[] = []
  const seenActorIds = new Set<string>()

  const resolveLoc = (actorId: string, where: string | undefined): { placeKey: string | null; regionKey: string | null; mapId: string | null } => {
    const stood = standingMap.get(actorId)
    const fromMap = stood ? smallestAt(stood.use.shapes, stood.standing.at) : null
    const placeKey = fromMap ?? parseWherePlace(where, worldId)
    const validPlace = placeKey && places[placeKey] ? placeKey : placeKey
    const rawRegion = validPlace && typeof places[validPlace]?.Region === 'string' ? String(places[validPlace].Region) : ''
    return {
      placeKey: validPlace ?? null,
      regionKey: rawRegion || null,
      mapId: stood?.mapId ?? null
    }
  }

  for (const n of activeNpcs) {
    const actorId = npcActorId(worldId, n.id)
    seenActorIds.add(actorId)
    const hasTemplate = templateIds.has(n.id)
    const hasOverrides =
      layer === 'play' &&
      Boolean(save) &&
      (!hasTemplate || (save !== null && save.npcs[n.id] !== undefined))
    const isPlayer = playerSheet === actorId
    const inParty = partySet.has(actorId)
    const roleKind: CastRoleKind = n.archetype
      ? 'archetype'
      : isPlayer
        ? 'player'
        : inParty
          ? 'party'
          : hasTemplate
            ? 'world-npc'
            : 'stamped'

    const loc = n.archetype ? { placeKey: null, regionKey: null, mapId: null } : resolveLoc(actorId, n.story.where)
    const hpFromGame = recordHealth(n.game, catalog)
    const dndHp: DndStats['hp'] | undefined = n.dnd?.hp
    const hp = hpFromGame ?? (dndHp && dndHp.max > 0 ? dndHp : null)
    const doing = n.story.doing?.trim() ?? ''
    const goal = n.story.goal?.trim() ?? ''
    const mood = n.story.mood?.trim() ?? ''
    const summaryFields = n.fields
      .map((f) => n.values[f]?.trim() ?? '')
      .filter(Boolean)
      .slice(0, 1)
      .join(' · ')

    out.push({
      actorId,
      entry: actorEntry(actorId),
      link: actorLink(actorId),
      title: n.title,
      image: n.image,
      isWorldNpc: true,
      npcId: n.id,
      archetype: Boolean(n.archetype),
      hasTemplate,
      hasOverrides,
      sourceTemplateId: n.sourceTemplateId ?? null,
      roleKind,
      faction: n.faction,
      placeKey: loc.placeKey,
      regionKey: loc.regionKey,
      mapId: loc.mapId,
      doing,
      goal,
      mood,
      line: summaryFields,
      hp,
      statPills: extractStatPills(n.game, catalog)
    })
  }

  // Include standalone Characters (@sheet) present in this world
  if (layer === 'play') {
    for (const v of visitors) {
      if (seenActorIds.has(v.sheet) || splitNpcRef(v.sheet)) continue
      seenActorIds.add(v.sheet)
      const isPlayer = playerSheet === v.sheet
      const inParty = partySet.has(v.sheet)
      const roleKind: CastRoleKind = isPlayer ? 'player' : inParty ? 'party' : 'character'
      const charWhere = save?.characters[v.sheet]?.where
      const loc = resolveLoc(v.sheet, charWhere)
      const hpFromGame = recordHealth(v.game, catalog)
      const hp = hpFromGame ?? (v.dnd?.hp && v.dnd.hp.max > 0 ? v.dnd.hp : null)
      out.push({
        actorId: v.sheet,
        entry: actorEntry(v.sheet),
        link: actorLink(v.sheet),
        title: v.name,
        image: v.image,
        isWorldNpc: false,
        npcId: null,
        archetype: false,
        hasTemplate: false,
        hasOverrides: false,
        sourceTemplateId: null,
        roleKind,
        faction: v.faction ?? null,
        placeKey: loc.placeKey,
        regionKey: loc.regionKey,
        mapId: loc.mapId,
        doing: '',
        goal: '',
        mood: '',
        line: v.line ?? '',
        hp,
        statPills: extractStatPills(v.game ?? null, catalog)
      })
    }
  }

  return out.sort(
    (a, b) => roleLabelOrder(a.roleKind) - roleLabelOrder(b.roleKind) || a.title.localeCompare(b.title)
  )
}
