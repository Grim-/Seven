import { noteFailure } from '../util/report'
import { GameEntity, isEntityVisible } from '@shared/game/core'
import { catalogFrom } from '@shared/game/defs'
import { placesIn, type PlaceVisitor, type Standing, type WorldMapUse } from '@shared/maps'
import { smallestAt } from '@shared/shapes'
import { PLACE_TYPE_KEY } from '@shared/world'
import { npcActorId, npcToSheet } from '@shared/worldNpcs'
import { gameDefs } from '../../modules/game/store'
import { getSheet, sheetIds, sheetLine } from '../library/sheets'
import type { CharacterSheet } from '@shared/types'
import { agentAccess } from '../agents/access'
import { npcs } from './npcs'
import { worlds } from './store'
import { saveInPlay } from './playLayer'

function isRecordHidden(s: CharacterSheet): boolean {
  if (!s.game) return false
  try {
    const entity = GameEntity.fromRecord(s.game, catalogFrom(gameDefs.catalog()))
    return !isEntityVisible(entity)
  } catch (err) {
    noteFailure(err, 'worlds', 'Could not evaluate entity visibility')
    return false
  }
}

export function visitorOf(s: CharacterSheet, agents: { id: string; sheet?: string | null }[]): PlaceVisitor {
  return {
    sheet: s.id,
    name: s.title,
    image: s.image,
    line: sheetLine(s),
    dnd: s.dnd ? { hp: s.dnd.hp, ac: s.dnd.ac, stats: s.dnd.stats, conditions: s.dnd.conditions, speed: s.dnd.speed, hitDice: s.dnd.hitDice } : null,
    game: s.game ?? null,
    gameRules: s.gameRules ?? '',
    faction: s.faction ?? null,
    hidden: isRecordHidden(s),
    agent: agents.find((a) => a.sheet === s.id)?.id ?? null
  }
}

export function visitorsOf(ids: string[]): PlaceVisitor[] {
  const agents = agentAccess.list()
  return ids.flatMap((id) => {
    try {
      return [visitorOf(getSheet(id), agents)]
    } catch (err) {
      noteFailure(err, 'worlds', "Could not read a character's place")
      return []
    }
  })
}

export function whoIsHere(world: string): Record<string, PlaceVisitor[]> {
  if (!worlds.exists(world)) return {}
  const places = worlds.entities(world, PLACE_TYPE_KEY, false)
  const agents = agentAccess.list()
  const out: Record<string, PlaceVisitor[]> = {}
  const save = saveInPlay(world, false)
  const seen = new Set<string>()

  // Build spatial lookup of every token currently standing on any map in this world.
  // Spatial truth: if a token is on a map, it is ONLY at a place if its coordinates lie inside that place's zone.
  const uses = worlds.mapUses(world)
  const standingOnMap = new Map<string, { use: WorldMapUse; standing: Standing }>()
  for (const use of uses) {
    const mergedStand: Record<string, Standing> = { ...use.stand, ...(save?.stand[use.map] ?? {}) }
    for (const [tokenKey, st] of Object.entries(mergedStand)) {
      standingOnMap.set(tokenKey, { use, standing: st })
    }
  }

  const resolvedPlacesFor = (actorId: string, where: string): string[] => {
    const live = standingOnMap.get(actorId)
    if (live) {
      const inside = smallestAt(live.use.shapes, live.standing.at)
      return inside ? [inside] : []
    }
    return placesIn(where, world, places)
  }

  const pushSheet = (id: string, requireUnbound: boolean) => {
    if (seen.has(id)) return
    let s: CharacterSheet
    try {
      s = getSheet(id)
    } catch (err) {
      noteFailure(err, 'worlds', "Could not read a character's place")
      return
    }
    if (requireUnbound && s.save) return
    seen.add(id)
    for (const key of resolvedPlacesFor(id, s.story.where)) out[key] = [...(out[key] ?? []), visitorOf(s, agents)]
  }

  for (const id of Object.keys(save?.characters ?? {})) pushSheet(id, false)
  const rules = worlds.meta(world).rules
  for (const npc of npcs.list(world, 'play')) {
    if (npc.archetype) continue
    const actorId = npcActorId(world, npc.id)
    if (seen.has(actorId)) continue
    seen.add(actorId)
    const sheet = npcToSheet(npc, world, rules)
    for (const key of resolvedPlacesFor(actorId, sheet.story.where)) {
      out[key] = [...(out[key] ?? []), visitorOf(sheet, agents)]
    }
  }
  for (const { id } of sheetIds()) pushSheet(id, true)
  return out
}
