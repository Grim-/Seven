import { toId } from '@shared/ids'
import {
  RELATION_CATEGORIES,
  RELATION_STANCES,
  cleanCategory,
  cleanStance,
  linkTagOf,
  parseLinkRef,
  removeRelationship,
  upsertRelationship,
  type RelationCategory,
  type RelationshipEntry,
  type RelationshipPatch
} from '@shared/relationships'
import { canSee, find as libraryFind, kinds, type KindContext } from './library/kinds'
import type { JsonObjectSchema } from './tools/schema'
import { ToolError, optBool, optInt, optStr } from './tools/types'

const TEXT = (description: string) => ({ type: ['string', 'null'], description }) as const

export function setRelationshipSchema(extra: JsonObjectSchema['properties'] = {}): JsonObjectSchema {
  return {
    type: 'object',
    properties: {
      ...extra,
      target: {
        type: 'string',
        description: 'Target name or @kind:id link (e.g. "Kestrel", "@place:blackwood_pass", "The Obsidian Key", "Arcane Debt")'
      },
      id: TEXT('Existing relationship id (rel_...) when renaming target'),
      category: {
        type: ['string', 'null'],
        enum: [...RELATION_CATEGORIES, null],
        description: 'Category: person, place, thing, faction, concept, or event (auto-detected from @kind:id when omitted; null keeps existing)'
      },
      role: TEXT('Short bond label, e.g. Mentor, Sanctuary, Stolen blade, Oath, Rival'),
      stance: {
        type: ['string', 'null'],
        enum: [...RELATION_STANCES, null],
        description: 'Disposition: devoted, allied, friendly, neutral, wary, unfriendly, or hostile'
      },
      affinity: { type: ['integer', 'null'], description: 'Optional numeric score from -100 to 100' },
      notes: TEXT('Concise relationship status or shared context'),
      secret: TEXT('Hidden truth or private motive kept separate from public stance'),
      tags: { type: ['array', 'null'], items: { type: 'string' }, description: 'Topic/recall keywords' },
      pin: { type: ['boolean', 'null'], description: 'true keeps this relationship pinned in the default prompt' }
    }
  }
}

export function removeRelationshipSchema(extra: JsonObjectSchema['properties'] = {}): JsonObjectSchema {
  return {
    type: 'object',
    properties: {
      ...extra,
      target_or_id: { type: 'string', description: 'Relationship id (rel_...) or target name' },
      category: {
        type: ['string', 'null'],
        enum: [...RELATION_CATEGORIES, null],
        description: 'Optional category when the same target name appears under multiple categories'
      }
    }
  }
}

function resolveVisibleRef(raw: string, kctx: KindContext): { ref: string; title: string } | null {
  const parsed = parseLinkRef(raw)
  if (!parsed) return null
  if (!canSee(parsed.kind, kctx)) return null
  const k = kinds(kctx).find((x) => x.kind === parsed.kind)
  if (!k) return null
  const hit = libraryFind(parsed.id, k.kind, 15, kctx).find(
    (h) => toId(h.id) === toId(parsed.id) || toId(h.title) === toId(parsed.id)
  )
  return hit ? { ref: `${k.kind}/${hit.id}`, title: hit.title } : null
}

function cleanTagsParam(raw: unknown): string[] | null {
  if (raw === null || raw === undefined) return null
  if (!Array.isArray(raw)) throw new ToolError('tags must be an array of strings or null.')
  return raw.map((x) => String(x).trim()).filter(Boolean)
}

export function extractRelationshipPatch(params: Record<string, unknown>, kctx: KindContext): RelationshipPatch {
  const rawTarget = optStr(params, 'target')?.trim() ?? ''
  const existingId = optStr(params, 'id')?.trim() || null
  if (!rawTarget && !existingId) throw new ToolError('Give target (name or @kind:id) or id (rel_...).')

  const rawCat = optStr(params, 'category')?.trim()
  if (rawCat && !(RELATION_CATEGORIES as readonly string[]).includes(rawCat.toLowerCase())) {
    throw new ToolError(`category must be one of: ${RELATION_CATEGORIES.join(', ')}.`)
  }
  const category = rawCat ? cleanCategory(rawCat) : null

  const rawStance = optStr(params, 'stance')?.trim()
  if (rawStance && !(RELATION_STANCES as readonly string[]).includes(rawStance.toLowerCase())) {
    throw new ToolError(`stance must be one of: ${RELATION_STANCES.join(', ')}.`)
  }
  const stance = rawStance ? cleanStance(rawStance) : null

  const affinity = optInt(params, 'affinity')
  const link = rawTarget ? resolveVisibleRef(rawTarget, kctx) : null
  const parsedLink = rawTarget ? parseLinkRef(rawTarget) : null
  const target = link ? link.title : rawTarget

  return {
    id: existingId,
    target: target || null,
    ...(link ? { ref: link.ref } : parsedLink ? { ref: null } : {}),
    category,
    role: optStr(params, 'role'),
    stance,
    ...(affinity !== null ? { affinity } : {}),
    notes: optStr(params, 'notes'),
    secret: optStr(params, 'secret'),
    tags: cleanTagsParam(params.tags),
    pinned: optBool(params, 'pin')
  }
}

export function applyRelationshipUpsert(list: RelationshipEntry[], patch: RelationshipPatch): { list: RelationshipEntry[]; entry: RelationshipEntry; created: boolean } {
  const result = upsertRelationship(list, patch)
  if (!result.ok) {
    if (!result.matches.length) throw new ToolError('Give a non-empty target name or existing id (rel_...).')
    const options = result.matches.map((m) => `${m.id} (${m.category}${m.role ? `: ${m.role}` : ''})`).join(', ')
    throw new ToolError(`Multiple relationships match "${patch.target}". Pass id or category: ${options}.`)
  }
  return { list: result.list, entry: result.entry, created: result.created }
}

export function applyRelationshipRemove(list: RelationshipEntry[], targetOrId: string, categoryRaw: string | null): { list: RelationshipEntry[]; removed: RelationshipEntry } {
  const category = categoryRaw && (RELATION_CATEGORIES as readonly string[]).includes(categoryRaw.toLowerCase()) ? cleanCategory(categoryRaw) : null
  const result = removeRelationship(list, targetOrId, category)
  if (!result.ok) {
    if (result.reason === 'ambiguous') {
      const options = result.matches.map((m) => `${m.id} (${m.category}${m.role ? `: ${m.role}` : ''})`).join(', ')
      throw new ToolError(`Multiple relationships match "${targetOrId}". Pass id or category: ${options}.`)
    }
    throw new ToolError(`No relationship matching "${targetOrId}" found.`)
  }
  return { list: result.list, removed: result.removed }
}

export function formatRelationshipDetail(ownerLabel: string, entry: RelationshipEntry): string {
  const aff = typeof entry.affinity === 'number' ? ` (${entry.affinity >= 0 ? `+${entry.affinity}` : entry.affinity})` : ''
  return [
    `[${ownerLabel} · relationship · ${entry.category}] ${entry.target} (${entry.id})`,
    entry.ref ? `Link: ${linkTagOf(entry.ref)}` : '',
    entry.role ? `Role: ${entry.role}` : '',
    `Stance: ${entry.stance}${aff}`,
    entry.pinned ? 'Pinned: yes' : '',
    entry.tags?.length ? `Tags: ${entry.tags.join(', ')}` : '',
    entry.notes ? `Notes: ${entry.notes}` : '',
    entry.secret ? `Secret: ${entry.secret}` : ''
  ]
    .filter(Boolean)
    .join('\n')
}

export function formatRelationshipChange(action: 'Added' | 'Updated', ownerLabel: string, entry: RelationshipEntry): string {
  const aff = typeof entry.affinity === 'number' ? ` ${entry.affinity >= 0 ? `+${entry.affinity}` : entry.affinity}` : ''
  const role = entry.role ? ` · ${entry.role}` : ''
  const link = entry.ref ? ` (${linkTagOf(entry.ref)})` : ''
  const note = entry.notes ? `: "${entry.notes}"` : ''
  return `${action} ${ownerLabel} relationship → ${entry.target}${link} [${entry.category} · ${entry.stance}${aff}${role}]${note} (${entry.id}).`
}

export function cleanCategoryFilter(raw: string | null): RelationCategory | null {
  if (!raw) return null
  const clean = raw.trim().toLowerCase()
  return (RELATION_CATEGORIES as readonly string[]).includes(clean) ? (clean as RelationCategory) : null
}
