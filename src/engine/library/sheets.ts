import fs from 'node:fs'
import path from 'node:path'
import type { CharacterSheet } from '@shared/types'
import { cleanDnd, dndLine, dndRoleplay, dndText, type DndStats } from '@shared/dnd'
import { cleanStory, storyText, type Story } from '@shared/story'
import { data } from '../data/hub'
import { dataRoot } from '../util/paths'
import { copyPath } from '../util/fs'

export const SHEET_TYPE = 'sheet'
export const SHEET_FIELDS = ['Identity', 'Appearance', 'Relations', 'Motivations & goals', 'Speech', 'Core beliefs']
const OLD_DND_TYPE = 'dnd:character'

interface SheetData {
  fields: string[]
  values: Record<string, string>
  dnd: DndStats | null
  story: Story
}

function clean(raw: unknown): SheetData {
  const d = (raw && typeof raw === 'object' ? raw : {}) as { fields?: unknown; values?: unknown; dnd?: unknown; story?: unknown }
  const fields = Array.isArray(d.fields) ? [...new Set(d.fields.map((f) => String(f).trim()).filter(Boolean))] : [...SHEET_FIELDS]
  const values: Record<string, string> = {}
  if (d.values && typeof d.values === 'object') for (const [k, v] of Object.entries(d.values as Record<string, unknown>)) if (typeof v === 'string') values[k] = v
  return { fields, values, dnd: d.dnd ? cleanDnd(d.dnd) : null, story: cleanStory(d.story, d.dnd) }
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

export function getSheet(ref: string): CharacterSheet {
  adoptDnd()
  const page = data.pages.get(ref)
  if (page.type !== SHEET_TYPE) throw new Error(`${page.title} is not a character. find with kind sheet lists characters.`)
  return { id: page.id, title: page.title, ...clean(page.data), image: page.image ?? null, updatedAt: page.updatedAt }
}

export function findSheet(ref: string): string | null {
  adoptDnd()
  return data.pages.find(ref, (p) => p.type === SHEET_TYPE)?.id ?? null
}

const whereWatchers: ((sheet: string, where: string) => void)[] = []

export function onWhereChange(fn: (sheet: string, where: string) => void): void {
  whereWatchers.push(fn)
}

export function saveSheet(input: { id: string | null; title: string; fields: string[]; values: Record<string, string>; dnd?: DndStats | null; story?: Story }): CharacterSheet {
  const title = input.title.trim()
  if (!title) throw new Error('Give the character a name, e.g. Mira.')
  if (input.id) {
    const page = data.pages.get(input.id)
    if (page.type !== SHEET_TYPE) throw new Error(`${page.title} is not a character. find with kind sheet lists characters.`)
    const current = clean(page.data)
    const value = clean({ fields: input.fields, values: input.values, dnd: input.dnd === undefined ? current.dnd : input.dnd, story: input.story ?? current.story })
    if (title !== page.title) data.pages.write({ ref: page.id, title })
    data.pages.setData(page.id, value)
    if (value.story.where !== current.story.where) for (const fn of whereWatchers) fn(page.id, value.story.where)
    return getSheet(page.id)
  }
  const value = clean({ fields: input.fields.length ? input.fields : SHEET_FIELDS, values: input.values, dnd: input.dnd ?? null, story: input.story })
  const page = data.pages.create({ title, type: SHEET_TYPE, data: value })
  return getSheet(page.id)
}

export function setDnd(ref: string, dnd: DndStats | null): CharacterSheet {
  const s = getSheet(ref)
  return saveSheet({ id: s.id, title: s.title, fields: s.fields, values: s.values, dnd })
}

export function setStory(ref: string, story: Story): CharacterSheet {
  const s = getSheet(ref)
  return saveSheet({ id: s.id, title: s.title, fields: s.fields, values: s.values, story })
}

export function sheetMarkdown(ref: string, roleplay = false): string {
  const s = getSheet(ref)
  const parts = [`# ${s.title}`]
  if (s.dnd) parts.push(roleplay ? `## Who\n${dndRoleplay(s.dnd)}` : `## D&D\n${dndText(s.dnd)}`)
  for (const field of s.fields) {
    const text = (s.values[field] ?? '').trim()
    if (text) parts.push(`## ${field}\n${text}`)
  }
  if (s.story.where || s.story.threads.length || s.story.sessions.length) parts.push(`## Story\n${storyText(s.story, roleplay)}`)
  return parts.join('\n\n')
}
