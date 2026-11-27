import { notFound } from '@shared/errors'
import fs from 'node:fs'
import path from 'node:path'
import type { CharacterMind, CharacterSheet } from '@shared/types'
import type { EntityRecord } from '@shared/game/core/GameEntity'
import { cleanDnd, dndLine, dndRoleplay, dndText, type DndStats } from '@shared/dnd'
import { cleanRelationships, formatRelationshipsMarkdown, type RelationshipEntry } from '@shared/relationships'
import { cleanStory, mindMemoriesText, storyHasContent, storyText, type Story } from '@shared/story'
import {
  cleanCharacterMind,
  cleanEntityRecord,
  SHEET_DEFAULT_FIELDS,
  splitNpcRef,
  stripSheetPrefix
} from '@shared/worldNpcs'
import {
  actorSheetOwner,
  findActorSheet,
  notifyActorWhereChange,
  onActorWhereChange,
  registerActorSheetSource,
  type SaveSheetInput
} from '../actors/sheets'
import { data } from '../data/hub'
import { dataRoot } from '../util/paths'
import { copyPath } from '../util/fs'

export const SHEET_TYPE = 'sheet'
export const SHEET_FIELDS = SHEET_DEFAULT_FIELDS
const OLD_DND_TYPE = 'dnd:character'

interface SheetData {
  fields: string[]
  values: Record<string, string>
  dnd: DndStats | null
  game: EntityRecord | null
  gameRules: string
  faction?: string | null
  save: string
  story: Story
  mind: CharacterMind | null
  relationships?: RelationshipEntry[]
}

function clean(raw: unknown): SheetData {
  const d = (raw && typeof raw === 'object' ? raw : {}) as {
    fields?: unknown
    values?: unknown
    dnd?: unknown
    game?: unknown
    gameRules?: unknown
    faction?: unknown
    save?: unknown
    story?: unknown
    mind?: unknown
    relationships?: unknown
  }
  const fields = Array.isArray(d.fields) ? [...new Set(d.fields.map((f) => String(f).trim()).filter(Boolean))] : [...SHEET_FIELDS]
  const values: Record<string, string> = {}
  if (d.values && typeof d.values === 'object') {
    for (const [k, v] of Object.entries(d.values as Record<string, unknown>)) {
      if (typeof v === 'string') values[k] = v
    }
  }
  const faction = typeof d.faction === 'string' ? d.faction.trim() || null : null
  const relationships = cleanRelationships(d.relationships)
  return {
    fields,
    values,
    dnd: d.dnd ? cleanDnd(d.dnd) : null,
    game: cleanEntityRecord(d.game),
    gameRules: typeof d.gameRules === 'string' ? d.gameRules : '',
    faction,
    save: typeof d.save === 'string' ? d.save : '',
    story: cleanStory(d.story, d.dnd),
    mind: cleanCharacterMind(d.mind, d.story),
    ...(relationships.length ? { relationships } : {})
  }
}

function adoptDnd(): void {
  const old = data.pages.ofType(OLD_DND_TYPE)
  if (!old.length) return
  const backup = path.join(dataRoot, '_backup', `dnd-to-sheets-${Date.now()}`)
  fs.mkdirSync(backup, { recursive: true })
  for (const meta of old) {
    const file = data.pages.fileFor(meta.id)
    copyPath(file, path.join(backup, path.basename(file)))
    const page = data.pages.get(meta.id)
    const notes = page.body.trim()
    data.pages.retype(meta.id, SHEET_TYPE, { fields: notes ? ['Notes'] : [], values: notes ? { Notes: notes } : {}, dnd: cleanDnd(page.data) })
  }
}

export function sheetIds(): { id: string; title: string; updatedAt: number }[] {
  adoptDnd()
  return data.pages.ofType(SHEET_TYPE).map((p) => ({ id: p.id, title: p.title, updatedAt: p.updatedAt }))
}

export function sheetLine(s: CharacterSheet): string {
  return s.dnd ? dndLine(s.dnd) : s.fields.filter((f) => s.values[f]?.trim()).join(', ') || 'empty'
}

export interface SheetInSave {
  game: EntityRecord | null
  gameRules: string
  where: string
  world?: string
  almanacId?: string | null
}

export interface SheetLayer {
  read(sheet: string, save: string): SheetInSave | null
  writeGame(sheet: string, save: string, game: EntityRecord | null): void
  writeWhere(sheet: string, save: string, where: string): void
}

let layer: SheetLayer | null = null

export function setSheetLayer(next: SheetLayer): void {
  layer = next
}

function storedPageSheet(ref: string): { page: ReturnType<typeof data.pages.get>; value: SheetData } {
  adoptDnd()
  const page = data.pages.get(stripSheetPrefix(ref))
  if (page.type !== SHEET_TYPE) throw notFound(new Error(`${page.title} is not a character. find('sheet', null) lists characters.`))
  return { page, value: clean(page.data) }
}

function inSave(id: string, value: SheetData): SheetInSave | null {
  return value.save && layer ? layer.read(id, value.save) : null
}

function getPageSheet(ref: string): CharacterSheet {
  const { page, value } = storedPageSheet(ref)
  const live = inSave(page.id, value)
  const shown = live ? { ...value, game: live.game, gameRules: live.gameRules, story: { ...value.story, where: live.where } } : { ...value, save: '' }
  return { id: page.id, title: page.title, ...shown, image: page.image ?? null, updatedAt: page.updatedAt }
}

function savePageSheet(input: SaveSheetInput): CharacterSheet {
  const title = input.title.trim()
  if (!title) throw new Error('Give the character a name, e.g. Mira.')
  if (input.id) {
    const { page, value: current } = storedPageSheet(input.id)
    const live = inSave(page.id, current)
    if (live && layer) {
      if (input.game !== undefined && JSON.stringify(input.game) !== JSON.stringify(live.game)) {
        layer.writeGame(page.id, current.save, input.game)
      }
      const where = input.story?.where
      if (where !== undefined && where !== live.where) {
        layer.writeWhere(page.id, current.save, where)
        notifyActorWhereChange(page.id, where)
      }
    }
    const story = input.story ? (live ? { ...input.story, where: current.story.where } : input.story) : current.story
    const value = clean({
      fields: input.fields,
      values: input.values,
      dnd: input.dnd === undefined ? current.dnd : input.dnd,
      game: live || input.game === undefined ? current.game : input.game,
      gameRules: live ? current.gameRules : (input.gameRules ?? current.gameRules),
      faction: input.faction === undefined ? current.faction : input.faction,
      save: current.save,
      story,
      mind: input.mind === undefined ? current.mind : input.mind,
      relationships: input.relationships === undefined ? current.relationships : input.relationships
    })
    if (title !== page.title) data.pages.write({ ref: page.id, title })
    data.pages.setData(page.id, value)
    if (!live && value.story.where !== current.story.where) notifyActorWhereChange(page.id, value.story.where)
    return getPageSheet(page.id)
  }
  const value = clean({
    fields: input.fields.length ? input.fields : SHEET_FIELDS,
    values: input.values,
    dnd: input.dnd ?? null,
    game: input.game ?? null,
    gameRules: input.gameRules ?? '',
    faction: input.faction ?? null,
    story: input.story,
    mind: input.mind ?? null,
    relationships: input.relationships
  })
  const page = data.pages.create({ title, type: SHEET_TYPE, data: value })
  return getPageSheet(page.id)
}

function findPageSheet(ref: string): string | null {
  adoptDnd()
  const cleanRef = stripSheetPrefix(ref)
  if (!cleanRef || splitNpcRef(ref)) return null
  return data.pages.find(cleanRef, (p) => p.type === SHEET_TYPE)?.id ?? null
}

registerActorSheetSource({
  id: 'sheet',
  priority: 10,
  owns: (ref) => {
    if (splitNpcRef(ref)) return false
    const trimmed = ref.trim()
    if (/^@?sheet:/i.test(trimmed)) return true
    return data.pages.metaFor(stripSheetPrefix(trimmed))?.type === SHEET_TYPE
  },
  find: (ref) => findPageSheet(ref),
  get: (id) => getPageSheet(id),
  save: (input) => savePageSheet(input),
  setImage: (id, image) => {
    const { page } = storedPageSheet(id)
    data.pages.setImage(page.id, image)
  },
  worldsOf: (id) => {
    const { page, value } = storedPageSheet(id)
    const live = inSave(page.id, value)
    return live?.world ? [live.world] : []
  },
  campaignOf: (id) => {
    const { page, value } = storedPageSheet(id)
    return inSave(page.id, value)?.almanacId ?? null
  }
})

export const onWhereChange = onActorWhereChange

export function getSheet(ref: string): CharacterSheet {
  const owner = actorSheetOwner(ref)
  if (owner) return owner.get(ref)
  const hit = findActorSheet(ref)
  if (hit) return hit.source.get(hit.id)
  return getPageSheet(ref)
}

export function setSheetSave(ref: string, save: string, carried?: { game: EntityRecord | null; gameRules: string }): void {
  if (splitNpcRef(ref)) return
  const { page, value } = storedPageSheet(ref)
  data.pages.setData(page.id, { ...value, save, ...(carried ?? {}) })
}

export function storedGame(ref: string): { game: EntityRecord | null; gameRules: string; where: string } {
  if (splitNpcRef(ref)) {
    const s = getSheet(ref)
    return { game: s.game ?? null, gameRules: s.gameRules ?? '', where: s.story.where }
  }
  const { value } = storedPageSheet(ref)
  return { game: value.game, gameRules: value.gameRules, where: value.story.where }
}

export function findSheet(ref: string, worldHint?: string | null): string | null {
  return findActorSheet(ref, worldHint)?.id ?? null
}

export function saveSheet(input: SaveSheetInput): CharacterSheet {
  if (input.id) {
    const owner = actorSheetOwner(input.id)
    if (owner) return owner.save(input)
  }
  return savePageSheet(input)
}

export function setSheetImage(ref: string, image: string | null): CharacterSheet {
  const owner = actorSheetOwner(ref) ?? findActorSheet(ref)?.source
  if (owner) {
    owner.setImage(ref, image)
    return owner.get(ref)
  }
  const { page } = storedPageSheet(ref)
  data.pages.setImage(page.id, image)
  return getPageSheet(page.id)
}

export function campaignOfActor(ref: string): string | null {
  const hit = findActorSheet(ref)
  return hit ? hit.source.campaignOf(hit.id) : null
}

export function setDnd(ref: string, dnd: DndStats | null): CharacterSheet {
  const s = getSheet(ref)
  return saveSheet({ id: s.id, title: s.title, fields: s.fields, values: s.values, dnd })
}

export function setGame(ref: string, game: EntityRecord | null, gameRules?: string): CharacterSheet {
  const s = getSheet(ref)
  return saveSheet({ id: s.id, title: s.title, fields: s.fields, values: s.values, game, gameRules })
}

export function setStory(ref: string, story: Story): CharacterSheet {
  const s = getSheet(ref)
  return saveSheet({ id: s.id, title: s.title, fields: s.fields, values: s.values, story })
}

export function setMind(ref: string, mind: CharacterMind | null): CharacterSheet {
  const s = getSheet(ref)
  return saveSheet({ id: s.id, title: s.title, fields: s.fields, values: s.values, mind })
}

export function setSheetRelationships(ref: string, relationships: RelationshipEntry[]): CharacterSheet {
  const s = getSheet(ref)
  return saveSheet({ id: s.id, title: s.title, fields: s.fields, values: s.values, relationships })
}

export function setSheetFaction(ref: string, faction: string | null): CharacterSheet {
  const s = getSheet(ref)
  return saveSheet({ id: s.id, title: s.title, fields: s.fields, values: s.values, dnd: s.dnd, game: s.game, gameRules: s.gameRules, faction, story: s.story })
}

const sections: ((sheet: CharacterSheet) => string | null)[] = []

export function registerSheetSection(section: (sheet: CharacterSheet) => string | null): void {
  sections.push(section)
}

export function characterMindFor(refs: string[], worldHint?: string | null): CharacterMind | null {
  let reasoningStyle: string | null = null
  const thinks: string[] = []
  const constraints: string[] = []
  let forceReason = false
  for (const ref of refs) {
    const id = findSheet(ref, worldHint)
    if (!id) continue
    const m = getSheet(id).mind
    if (!m) continue
    if (!reasoningStyle && m.reasoningStyle) reasoningStyle = m.reasoningStyle
    if (m.howItThinks?.trim()) thinks.push(m.howItThinks.trim())
    if (m.voiceConstraints?.trim()) constraints.push(m.voiceConstraints.trim())
    if (m.forceReason) forceReason = true
  }
  if (!reasoningStyle && !thinks.length && !constraints.length && !forceReason) return null
  return {
    ...(reasoningStyle ? { reasoningStyle } : {}),
    ...(thinks.length ? { howItThinks: thinks.join('\n') } : {}),
    ...(constraints.length ? { voiceConstraints: constraints.join('\n') } : {}),
    ...(forceReason ? { forceReason: true } : {})
  }
}

export function sheetMarkdown(ref: string, roleplay = false): string {
  return sheetMarkdownOf(getSheet(ref), roleplay)
}

export function sheetMarkdownOf(s: CharacterSheet, roleplay = false): string {
  const parts = [`# ${s.title}`]
  if (s.faction) parts.push(`## Faction\nAllegiance: @faction:${s.faction}`)
  if (s.dnd) parts.push(roleplay ? `## Who\n${dndRoleplay(s.dnd)}` : `## D&D\n${dndText(s.dnd)}`)
  for (const field of s.fields) {
    const text = (s.values[field] ?? '').trim()
    if (text) parts.push(`## ${field}\n${text}`)
  }
  for (const section of sections) {
    const text = section(s)
    if (text) parts.push(text)
  }
  if (s.relationships?.length) {
    const relText = formatRelationshipsMarkdown(s.relationships, { pinnedOnly: true, recallTool: 'character_recall_relation' })
    if (relText) parts.push(`## Relationships\n${relText}`)
  }
  if (s.mind?.memories?.length) {
    const memText = mindMemoriesText(s.mind.memories)
    if (memText) parts.push(`## Mind\n${memText}`)
  }
  if (storyHasContent(s.story)) parts.push(`## Story\n${storyText(s.story, roleplay)}`)
  return parts.join('\n\n')
}
