import { cleanMemories, cleanStory, type StoryMemory, type StorySession, type StoryThread } from './story'
import { cleanRelationships, type RelationshipEntry } from './relationships'
import type { CharacterSheet } from './types'

export interface CharacterHold {
  memories: StoryMemory[]
  sessions: StorySession[]
  threads: StoryThread[]
  relationships: RelationshipEntry[]
  knowledge: string[]
}

export function emptyHold(): CharacterHold {
  return { memories: [], sessions: [], threads: [], relationships: [], knowledge: [] }
}

export const refList = (raw: unknown): string[] => (Array.isArray(raw) ? [...new Set(raw.filter((r): r is string => typeof r === 'string' && Boolean(r.trim())).map((r) => r.trim()))] : [])

export function cleanHold(raw: unknown): CharacterHold {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const story = cleanStory({ where: '', threads: r.threads, sessions: r.sessions })
  return { memories: cleanMemories(r.memories), sessions: story.sessions, threads: story.threads, relationships: cleanRelationships(r.relationships), knowledge: refList(r.knowledge) }
}

export function holdIsEmpty(h: CharacterHold): boolean {
  return !h.memories.length && !h.sessions.length && !h.threads.length && !h.relationships.length && !h.knowledge.length
}

export function innateHold(s: CharacterSheet): CharacterHold {
  return {
    memories: s.mind?.memories ?? [],
    sessions: s.story.sessions,
    threads: s.story.threads,
    relationships: s.relationships ?? [],
    knowledge: s.mind?.knowledge ?? []
  }
}

export function sheetWithHold(s: CharacterSheet, hold: CharacterHold): CharacterSheet {
  if (holdIsEmpty(hold)) return s
  return {
    ...s,
    story: { ...s.story, sessions: [...s.story.sessions, ...hold.sessions], threads: [...s.story.threads, ...hold.threads] },
    mind: { ...(s.mind ?? {}), memories: [...(s.mind?.memories ?? []), ...hold.memories], knowledge: [...new Set([...(s.mind?.knowledge ?? []), ...hold.knowledge])] },
    relationships: [...(s.relationships ?? []), ...hold.relationships]
  }
}
