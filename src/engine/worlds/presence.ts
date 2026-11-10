import { placesIn, type PlaceVisitor } from '@shared/maps'
import { PLACE_TYPE_KEY } from '@shared/world'
import { getSheet, sheetLine } from '../library/sheets'
import type { CharacterSheet } from '@shared/types'
import { agentAccess } from '../agents/access'
import { worlds } from './store'
import { saveInPlay } from './playLayer'

function visitorOf(s: CharacterSheet, agents: { id: string; sheet?: string | null }[]): PlaceVisitor {
  return {
    sheet: s.id,
    name: s.title,
    image: s.image,
    line: sheetLine(s),
    dnd: s.dnd ? { hp: s.dnd.hp, ac: s.dnd.ac, stats: s.dnd.stats, conditions: s.dnd.conditions } : null,
    game: s.game ?? null,
    gameRules: s.gameRules ?? '',
    faction: s.faction ?? null,
    agent: agents.find((a) => a.sheet === s.id)?.id ?? null
  }
}

export function visitorsOf(ids: string[]): PlaceVisitor[] {
  const agents = agentAccess.list()
  return ids.flatMap((id) => {
    try {
      return [visitorOf(getSheet(id), agents)]
    } catch {
      return []
    }
  })
}

export function whoIsHere(world: string): Record<string, PlaceVisitor[]> {
  if (!worlds.schema(world).types[PLACE_TYPE_KEY]) return {}
  const places = worlds.entities(world, PLACE_TYPE_KEY, false)
  const agents = agentAccess.list()
  const out: Record<string, PlaceVisitor[]> = {}
  for (const id of Object.keys(saveInPlay(world, false)?.characters ?? {})) {
    let s: CharacterSheet
    try {
      s = getSheet(id)
    } catch {
      continue
    }
    for (const key of placesIn(s.story.where, world, places)) out[key] = [...(out[key] ?? []), visitorOf(s, agents)]
  }
  return out
}
