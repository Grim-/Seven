import { notFound } from '@shared/errors'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { toId } from '@shared/ids'
import { cleanKnowledge, knowledgeRef, splitKnowledgeRef, type WorldKnowledge } from '@shared/worldKnowledge'
import type { KnownItem } from '@shared/story'
import type { CharacterSheet } from '@shared/types'
import { readJson, writeJson } from '../util/fs'
import { ToolError } from '../tools/types'
import { worlds } from './store'
import { getSheet, registerSheetSection } from '../library/sheets'
import { editHold, holdsOf } from '../library/holds'
import { almanacs } from '../almanac/store'
import { saves } from './saves'
import { worldLink } from '@shared/world'
import { actorLink, splitNpcRef } from '@shared/worldNpcs'

class KnowledgeStore extends EventEmitter {
  private file(world: string): string {
    return path.join(worlds.folder(world), 'knowledge.json')
  }

  list(world: string): WorldKnowledge[] {
    return readJson<unknown[]>(this.file(world), [])
      .map(cleanKnowledge)
      .filter((k): k is WorldKnowledge => k !== null)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  get(world: string, id: string): WorldKnowledge {
    const hit = this.list(world).find((k) => k.id === id)
    if (!hit) throw notFound(new ToolError(`No knowledge "${id}" in world ${world}.`))
    return hit
  }

  find(world: string, ref: string): WorldKnowledge | null {
    const id = toId(ref)
    const all = this.list(world)
    return all.find((k) => k.id === id) ?? all.find((k) => toId(k.name) === id) ?? null
  }

  save(world: string, raw: unknown, previousId: string | null = null): WorldKnowledge {
    const k = cleanKnowledge(raw)
    if (!k) throw new ToolError('Give the knowledge a name.')
    const saved = { ...k, updatedAt: Date.now() }
    this.write(world, [...this.list(world).filter((x) => x.id !== saved.id && x.id !== previousId), saved])
    return saved
  }

  remove(world: string, id: string): void {
    const all = this.list(world)
    if (!all.some((k) => k.id === id)) throw notFound(new ToolError(`No knowledge "${id}" in world ${world}.`))
    this.write(world, all.filter((k) => k.id !== id))
  }

  private write(world: string, list: WorldKnowledge[]): void {
    writeJson(this.file(world), list)
    this.emit('changed', world)
  }
}

export const knowledge = new KnowledgeStore()

export function worldsOfSheet(sheetId: string): string[] {
  const npc = splitNpcRef(sheetId)
  if (npc) return worlds.exists(npc.world) ? [npc.world] : []
  const ids = new Set(worlds.list().filter((w) => w.player === sheetId || worlds.mapUses(w.id).some((u) => sheetId in u.stand)).map((w) => w.id))
  for (const save of saves.all()) if (sheetId in save.characters) ids.add(save.world)
  for (const a of almanacs.list()) if (a.worldId && a.holds?.[sheetId]) ids.add(a.worldId)
  return [...ids].filter((id) => worlds.exists(id))
}

export function grantKnowledge(sheet: string, campaign: string | null, ref: string, opts: { source?: string | null; where?: string } = {}): boolean {
  const parts = splitKnowledgeRef(ref)
  const entry = parts && worlds.exists(parts.world) ? knowledge.find(parts.world, parts.id) : null
  if (!parts || !entry) throw notFound(new ToolError(`No knowledge ${ref}.`))
  const full = knowledgeRef(parts.world, entry.id)
  if (holdsOf(sheet, campaign).some((h) => h.hold.knowledge.includes(full))) return false
  editHold(sheet, campaign, (h) => ({ ...h, knowledge: [...h.knowledge, full] }))
  if (campaign) {
    const title = getSheet(sheet).title
    const source = opts.source?.trim()
    const whoLink = actorLink(sheet)
    almanacs.recordEntry(campaign, {
      kind: 'learned',
      title: `${title} learned of ${entry.name}`,
      summary: source ? `${title} learned of ${entry.name} from ${source}.` : `${title} came to know of ${entry.name}.`,
      who: [whoLink],
      where: opts.where ?? '',
      links: [worldLink(parts.world, 'knowledge', entry.id), whoLink]
    })
  }
  return true
}

export function knownBy(sheet: CharacterSheet, worldIds: string[], cuedOnly = false): KnownItem[] {
  const excluded = new Set(sheet.mind?.excluded ?? [])
  const held = new Set(sheet.mind?.knowledge ?? [])
  const out: KnownItem[] = []
  const seen = new Set<string>()
  const add = (world: string, k: WorldKnowledge) => {
    const ref = knowledgeRef(world, k.id)
    if (seen.has(ref)) return
    seen.add(ref)
    out.push({ ref, name: k.name, text: k.text, tags: k.tags, scope: k.scope, ...(k.pinned ? { pinned: true } : {}) })
  }
  const cued = (world: string, k: WorldKnowledge) => !cuedOnly || (k.cue ?? worlds.meta(world).knowledgeCues === true)
  for (const world of worldIds) {
    if (!worlds.exists(world)) continue
    for (const k of knowledge.list(world)) if ((k.scope === 'global' ? !excluded.has(knowledgeRef(world, k.id)) : held.has(knowledgeRef(world, k.id))) && cued(world, k)) add(world, k)
  }
  for (const ref of held) {
    const parts = splitKnowledgeRef(ref)
    if (!parts || !worlds.exists(parts.world)) continue
    const k = knowledge.find(parts.world, parts.id)
    if (k && cued(parts.world, k)) add(parts.world, k)
  }
  return out
}

registerSheetSection((sheet) => {
  const pinned = knownBy(sheet, worldsOfSheet(sheet.id)).filter((k) => k.pinned)
  if (!pinned.length) return null
  return `## Knows\n${pinned.map((k) => `- ${k.name} (${worldLink(k.ref.split('/')[0], 'knowledge', k.ref.split('/').slice(1).join('/'))}): ${k.text.trim()}`).join('\n')}`
})
