import type { DndStats } from '@shared/dnd'
import type { EntityRecord } from '@shared/game/core/GameEntity'
import type { RelationshipEntry } from '@shared/relationships'
import type { Story } from '@shared/story'
import type { CharacterMind, CharacterSheet } from '@shared/types'

export interface SaveSheetInput {
  id: string | null
  title: string
  fields: string[]
  values: Record<string, string>
  dnd?: DndStats | null
  game?: EntityRecord | null
  gameRules?: string
  faction?: string | null
  story?: Story
  mind?: CharacterMind | null
  relationships?: RelationshipEntry[]
}

export interface ActorSheetSource {
  id: string
  priority: number
  owns(ref: string): boolean
  find(ref: string, worldHint?: string | null): string | null
  get(id: string): CharacterSheet
  save(input: SaveSheetInput): CharacterSheet
  setImage(id: string, image: string | null): void
  worldsOf(id: string): string[]
  campaignOf(id: string): string | null
}

const sources: ActorSheetSource[] = []
const whereWatchers: ((sheet: string, where: string) => void)[] = []

export function registerActorSheetSource(source: ActorSheetSource): void {
  const at = sources.findIndex((s) => s.id === source.id)
  if (at >= 0) sources[at] = source
  else sources.push(source)
  sources.sort((a, b) => b.priority - a.priority)
}

export function actorSheetOwner(ref: string): ActorSheetSource | null {
  return sources.find((s) => s.owns(ref)) ?? null
}

export function findActorSheet(ref: string, worldHint?: string | null): { source: ActorSheetSource; id: string } | null {
  const direct = actorSheetOwner(ref)
  if (direct) {
    const id = direct.find(ref, worldHint)
    return id ? { source: direct, id } : null
  }
  for (const s of sources) {
    const id = s.find(ref, worldHint)
    if (id) return { source: s, id }
  }
  return null
}

export function onActorWhereChange(fn: (sheet: string, where: string) => void): void {
  whereWatchers.push(fn)
}

export function notifyActorWhereChange(sheet: string, where: string): void {
  for (const fn of whereWatchers) fn(sheet, where)
}
