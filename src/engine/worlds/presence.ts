import { noteFailure } from '../util/report'
import { GameEntity, isEntityVisible } from '@shared/game/core'
import { catalogFrom } from '@shared/game/defs'
import { placesIn, type PlaceVisitor } from '@shared/maps'
import { PLACE_TYPE_KEY } from '@shared/world'
import { gameDefs } from '../../modules/game/store'
import { getSheet, sheetIds, sheetLine } from '../library/sheets'
import type { CharacterSheet } from '@shared/types'
import { agentAccess } from '../agents/access'
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
    for (const key of placesIn(s.story.where, world, places)) out[key] = [...(out[key] ?? []), visitorOf(s, agents)]
  }

  for (const id of Object.keys(save?.characters ?? {})) pushSheet(id, false)
  for (const { id } of sheetIds()) pushSheet(id, true)
  return out
}
