import { refList } from './characterHold'
import { cleanDnd, type DndStats } from './dnd'
import type { EntityRecord } from './game/core/GameEntity'
import { toId } from './ids'
import type { CreatureDisposition } from './maps'
import { cleanRelationships, type RelationshipEntry } from './relationships'
import { cleanMemories, cleanStory, type Story } from './story'
import { linkFor } from './text'
import type { CharacterMind, CharacterSheet } from './types'
import { worldLink } from './world'

export const NPC_SEGMENT = 'npc'
export const SHEET_DEFAULT_FIELDS = ['Identity', 'Appearance', 'Relations', 'Motivations & goals', 'Speech', 'Core beliefs']

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

export function npcActorId(worldId: string, id: string): string {
  return `${worldId.trim()}/${NPC_SEGMENT}/${id.trim()}`
}

export function splitNpcRef(raw: string): { world: string; id: string } | null {
  const cleaned = raw
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/^@?world:/i, '')
  const parts = cleaned.split('/').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 3 || parts[1].toLowerCase() !== NPC_SEGMENT) return null
  return { world: parts[0], id: parts.slice(2).join('/') }
}

export function stripSheetPrefix(raw: string): string {
  return raw.trim().replace(/^"|"$/g, '').replace(/^@?sheet:/i, '')
}

export function actorLink(idOrRef: string): string {
  const trimmed = idOrRef.trim()
  const npc = splitNpcRef(trimmed)
  if (npc) return worldLink(npc.world, NPC_SEGMENT, npc.id)
  if (trimmed.startsWith('@')) return trimmed
  return linkFor('sheet', stripSheetPrefix(trimmed))
}

export function actorEntry(idOrRef: string): { kind: 'world' | 'sheet'; id: string } {
  const npc = splitNpcRef(idOrRef)
  if (npc) return { kind: 'world', id: npcActorId(npc.world, npc.id) }
  return { kind: 'sheet', id: stripSheetPrefix(idOrRef) }
}

export function cleanEntityRecord(raw: unknown): EntityRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<EntityRecord>
  return typeof r.uid === 'string' && Boolean(r.template) && typeof r.template === 'object' && Array.isArray(r.comps) ? (r as EntityRecord) : null
}

export function cleanCharacterMind(raw: unknown, legacyStory?: unknown): CharacterMind | null {
  const m = obj(raw)
  const reasoningStyle = typeof m.reasoningStyle === 'string' && m.reasoningStyle.trim() ? m.reasoningStyle.trim() : null
  const howItThinks = typeof m.howItThinks === 'string' ? m.howItThinks.trim() : ''
  const voiceConstraints = typeof m.voiceConstraints === 'string' ? m.voiceConstraints.trim() : ''
  const forceReason = m.forceReason === true
  const legacyObj = obj(legacyStory)
  const rawMemories = Array.isArray(m.memories)
    ? m.memories
    : Array.isArray(legacyObj.memories)
      ? legacyObj.memories
      : []
  const memories = cleanMemories(rawMemories)
  const knowledge = refList(m.knowledge)
  const excluded = refList(m.excluded)
  if (!reasoningStyle && !howItThinks && !voiceConstraints && !forceReason && !memories.length && !knowledge.length && !excluded.length) {
    return null
  }
  return {
    ...(reasoningStyle ? { reasoningStyle } : {}),
    ...(howItThinks ? { howItThinks } : {}),
    ...(voiceConstraints ? { voiceConstraints } : {}),
    ...(forceReason ? { forceReason: true } : {}),
    ...(memories.length ? { memories } : {}),
    ...(knowledge.length ? { knowledge } : {}),
    ...(excluded.length ? { excluded } : {})
  }
}

function cleanDisposition(raw: unknown): CreatureDisposition | undefined {
  const s = str(raw).trim().toLowerCase()
  return s === 'hostile' || s === 'neutral' || s === 'friendly' ? s : undefined
}

function cleanValuesMap(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj(raw))) {
    if (typeof v === 'string') out[k] = v
  }
  return out
}

function cleanFieldsList(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return [...fallback]
  return [...new Set(raw.map((f) => String(f).trim()).filter(Boolean))]
}

export interface WorldNpc {
  id: string
  worldId?: string
  title: string
  image: string | null
  fields: string[]
  values: Record<string, string>
  dnd: DndStats | null
  game: EntityRecord | null
  gameRules: string
  faction: string | null
  story: Story
  mind: CharacterMind | null
  relationships?: RelationshipEntry[]
  archetype?: boolean
  sourceTemplateId?: string | null
  disposition?: CreatureDisposition
  lootTableId?: string | null
  updatedAt: number
}

export interface SaveNpcState {
  title?: string
  image?: string | null
  fields?: string[]
  values?: Record<string, string>
  dnd?: DndStats | null
  game?: EntityRecord | null
  gameRules?: string
  faction?: string | null
  story?: Story
  mind?: CharacterMind | null
  relationships?: RelationshipEntry[]
  archetype?: boolean
  sourceTemplateId?: string | null
  disposition?: CreatureDisposition
  lootTableId?: string | null
  updatedAt?: number
}

export function cleanWorldNpc(raw: unknown, fallbackId?: string): WorldNpc | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const d = raw as Record<string, unknown>
  const game = cleanEntityRecord(d.game)
  const title = str(d.title || d.name).trim() || game?.name?.trim() || (fallbackId ? fallbackId.trim() : '')
  if (!title) return null
  const rawId = str(d.id).trim() || fallbackId?.trim() || toId(title)
  const id = toId(rawId) || rawId.replace(/[^a-zA-Z0-9_-]/g, '_')
  if (!id) return null
  const fields = cleanFieldsList(d.fields, SHEET_DEFAULT_FIELDS)
  const values = cleanValuesMap(d.values)
  const faction = typeof d.faction === 'string' ? d.faction.trim() || null : null
  const relationships = cleanRelationships(d.relationships)
  const disposition = cleanDisposition(d.disposition)
  const sourceTemplateId = typeof d.sourceTemplateId === 'string' && d.sourceTemplateId.trim() ? d.sourceTemplateId.trim() : null
  const lootTableId = typeof d.lootTableId === 'string' && d.lootTableId.trim() ? d.lootTableId.trim() : null
  const image = typeof d.image === 'string' && d.image.trim() ? d.image.trim() : null
  return {
    id,
    ...(typeof d.worldId === 'string' && d.worldId.trim() ? { worldId: d.worldId.trim() } : {}),
    title,
    image,
    fields,
    values,
    dnd: d.dnd ? cleanDnd(d.dnd) : null,
    game,
    gameRules: str(d.gameRules),
    faction,
    story: cleanStory(d.story, d.dnd),
    mind: cleanCharacterMind(d.mind, d.story),
    ...(relationships.length ? { relationships } : {}),
    ...(d.archetype === true ? { archetype: true } : {}),
    ...(sourceTemplateId ? { sourceTemplateId } : {}),
    ...(disposition ? { disposition } : {}),
    ...(lootTableId ? { lootTableId } : {}),
    updatedAt: num(d.updatedAt, 0)
  }
}

export function cleanSaveNpcState(raw: unknown): SaveNpcState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const d = raw as Record<string, unknown>
  const out: SaveNpcState = {}
  if (typeof d.title === 'string' && d.title.trim()) out.title = d.title.trim()
  else if (typeof d.name === 'string' && d.name.trim()) out.title = d.name.trim()
  if ('image' in d) out.image = typeof d.image === 'string' && d.image.trim() ? d.image.trim() : null
  if (Array.isArray(d.fields)) out.fields = cleanFieldsList(d.fields, [])
  if (d.values && typeof d.values === 'object' && !Array.isArray(d.values)) out.values = cleanValuesMap(d.values)
  if ('dnd' in d) out.dnd = d.dnd ? cleanDnd(d.dnd) : null
  if ('game' in d) out.game = cleanEntityRecord(d.game)
  if (typeof d.gameRules === 'string') out.gameRules = d.gameRules
  if ('faction' in d) out.faction = typeof d.faction === 'string' ? d.faction.trim() || null : null
  if (d.story && typeof d.story === 'object') out.story = cleanStory(d.story, d.dnd)
  if ('mind' in d) out.mind = cleanCharacterMind(d.mind, d.story)
  if ('relationships' in d) out.relationships = cleanRelationships(d.relationships)
  if (typeof d.archetype === 'boolean') out.archetype = d.archetype
  if ('sourceTemplateId' in d) out.sourceTemplateId = typeof d.sourceTemplateId === 'string' && d.sourceTemplateId.trim() ? d.sourceTemplateId.trim() : null
  const disp = cleanDisposition(d.disposition)
  if (disp) out.disposition = disp
  if ('lootTableId' in d) out.lootTableId = typeof d.lootTableId === 'string' && d.lootTableId.trim() ? d.lootTableId.trim() : null
  if (typeof d.updatedAt === 'number' && Number.isFinite(d.updatedAt)) out.updatedAt = d.updatedAt
  return out
}

export function cleanSaveNpcs(raw: unknown): Record<string, SaveNpcState | null> {
  const out: Record<string, SaveNpcState | null> = {}
  for (const [key, val] of Object.entries(obj(raw))) {
    const cleanKey = key.trim()
    if (!cleanKey) continue
    if (val === null) {
      out[cleanKey] = null
      continue
    }
    const cleaned = cleanSaveNpcState(val)
    if (cleaned) out[cleanKey] = cleaned
  }
  return out
}

export function mergeNpcState(
  base: WorldNpc | null,
  state: SaveNpcState | null | undefined,
  id: string,
  worldId: string
): WorldNpc | null {
  if (state === null) return null
  if (!base && !state) return null
  if (!base) {
    return cleanWorldNpc({ ...state, id, worldId }, id)
  }
  if (!state) return { ...base, worldId }
  const relationships = state.relationships !== undefined ? state.relationships : base.relationships
  return {
    ...base,
    worldId,
    title: state.title ?? base.title,
    image: state.image !== undefined ? state.image : base.image,
    fields: state.fields ?? base.fields,
    values: state.values ?? base.values,
    dnd: state.dnd !== undefined ? state.dnd : base.dnd,
    game: state.game !== undefined ? state.game : base.game,
    gameRules: state.gameRules ?? base.gameRules,
    faction: state.faction !== undefined ? state.faction : base.faction,
    story: state.story ?? base.story,
    mind: state.mind !== undefined ? state.mind : base.mind,
    ...(relationships?.length ? { relationships } : { relationships: undefined }),
    ...(state.archetype !== undefined ? (state.archetype ? { archetype: true } : { archetype: undefined }) : {}),
    ...(state.sourceTemplateId !== undefined ? { sourceTemplateId: state.sourceTemplateId } : {}),
    ...(state.disposition !== undefined ? { disposition: state.disposition } : {}),
    ...(state.lootTableId !== undefined ? { lootTableId: state.lootTableId } : {}),
    updatedAt: Math.max(base.updatedAt, state.updatedAt ?? 0)
  }
}

export function npcToSheet(npc: WorldNpc, worldId: string, worldRules = ''): CharacterSheet {
  return {
    id: npcActorId(worldId, npc.id),
    title: npc.title,
    image: npc.image,
    fields: npc.fields,
    values: npc.values,
    dnd: npc.dnd,
    game: npc.game,
    gameRules: npc.gameRules || worldRules,
    faction: npc.faction,
    save: '',
    story: npc.story,
    mind: npc.mind,
    ...(npc.relationships?.length ? { relationships: npc.relationships } : {}),
    updatedAt: npc.updatedAt
  }
}

export function entityRecordToNpcState(
  record: EntityRecord,
  opts: {
    title?: string
    faction?: string | null
    disposition?: CreatureDisposition
    where?: string
    sourceTemplateId?: string | null
    lootTableId?: string | null
  } = {}
): SaveNpcState {
  const title = opts.title?.trim() || record.name.trim() || record.uid
  const game = record.name === title ? record : { ...record, name: title }
  return {
    title,
    image: null,
    fields: [...SHEET_DEFAULT_FIELDS],
    values: {},
    dnd: null,
    game,
    gameRules: '',
    faction: opts.faction?.trim() || null,
    story: cleanStory({ where: opts.where ?? '' }),
    mind: null,
    ...(opts.sourceTemplateId ? { sourceTemplateId: opts.sourceTemplateId } : {}),
    ...(opts.disposition ? { disposition: opts.disposition } : {}),
    ...(opts.lootTableId ? { lootTableId: opts.lootTableId } : {}),
    updatedAt: Date.now()
  }
}
