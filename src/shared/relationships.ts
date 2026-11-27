import { showName, stripRef, toId } from './ids'
import { referencePattern } from './text'

export const RELATION_CATEGORIES = ['person', 'place', 'thing', 'faction', 'concept', 'event'] as const
export type RelationCategory = (typeof RELATION_CATEGORIES)[number]

export const RELATION_STANCES = ['devoted', 'allied', 'friendly', 'neutral', 'wary', 'unfriendly', 'hostile'] as const
export type RelationStance = (typeof RELATION_STANCES)[number]

export interface RelationshipEntry {
  id: string
  target: string
  ref?: string | null
  category: RelationCategory
  role: string
  stance: RelationStance
  affinity?: number | null
  notes: string
  secret?: string
  tags?: string[]
  pinned?: boolean
  updatedAt: number
}

export interface CategoryMeta {
  id: RelationCategory
  label: string
  plural: string
}

export const CATEGORY_METAS: readonly CategoryMeta[] = [
  { id: 'person', label: 'Person', plural: 'People' },
  { id: 'place', label: 'Place', plural: 'Places' },
  { id: 'thing', label: 'Thing', plural: 'Things' },
  { id: 'faction', label: 'Faction', plural: 'Factions' },
  { id: 'concept', label: 'Concept', plural: 'Concepts' },
  { id: 'event', label: 'Event', plural: 'Events' }
]

export interface StanceMeta {
  id: RelationStance
  label: string
  defaultAffinity: number
}

export const STANCE_METAS: readonly StanceMeta[] = [
  { id: 'devoted', label: 'Devoted', defaultAffinity: 90 },
  { id: 'allied', label: 'Allied', defaultAffinity: 65 },
  { id: 'friendly', label: 'Friendly', defaultAffinity: 35 },
  { id: 'neutral', label: 'Neutral', defaultAffinity: 0 },
  { id: 'wary', label: 'Wary', defaultAffinity: -25 },
  { id: 'unfriendly', label: 'Unfriendly', defaultAffinity: -55 },
  { id: 'hostile', label: 'Hostile', defaultAffinity: -85 }
]

const KIND_CATEGORY = new Map<string, RelationCategory>([
  ['sheet', 'person'],
  ['agent', 'person'],
  ['place', 'place'],
  ['world', 'place'],
  ['map', 'place'],
  ['faction', 'faction'],
  ['file', 'thing'],
  ['page', 'thing'],
  ['repo', 'thing'],
  ['card', 'thing'],
  ['deck', 'thing'],
  ['card_set', 'thing'],
  ['card_layout', 'thing'],
  ['cards.card', 'thing'],
  ['cards.deck', 'thing'],
  ['cards.set', 'thing'],
  ['cards.layout', 'thing'],
  ['slideshow', 'thing'],
  ['collection', 'thing'],
  ['loot_table', 'thing'],
  ['map_object', 'thing'],
  ['trigger_action', 'thing'],
  ['session', 'event'],
  ['decision', 'event'],
  ['story_action', 'event'],
  ['quest', 'event'],
  ['reminder', 'event'],
  ['workout', 'event']
])

export function categoryMeta(category: RelationCategory): CategoryMeta {
  return CATEGORY_METAS.find((c) => c.id === category) ?? CATEGORY_METAS[4]
}

export function stanceMeta(stance: RelationStance): StanceMeta {
  return STANCE_METAS.find((s) => s.id === stance) ?? STANCE_METAS[3]
}

export function categoryForKind(kind: string): RelationCategory {
  return KIND_CATEGORY.get(kind.trim().toLowerCase()) ?? 'concept'
}

export function cleanCategory(raw: unknown, fallback: RelationCategory = 'concept'): RelationCategory {
  if (typeof raw !== 'string') return fallback
  const clean = raw.trim().toLowerCase()
  return (RELATION_CATEGORIES as readonly string[]).includes(clean) ? (clean as RelationCategory) : fallback
}

export function cleanStance(raw: unknown, fallback: RelationStance = 'neutral'): RelationStance {
  if (typeof raw !== 'string') return fallback
  const clean = raw.trim().toLowerCase()
  return (RELATION_STANCES as readonly string[]).includes(clean) ? (clean as RelationStance) : fallback
}

export function cleanAffinity(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.max(-100, Math.min(100, Math.round(n)))
}

function cleanTags(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    const val = typeof item === 'string' ? item.trim() : ''
    if (!val) continue
    const key = val.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(val)
  }
  return out.length ? out : undefined
}

export function parseLinkRef(raw: unknown): { kind: string; id: string; ref: string } | null {
  if (typeof raw !== 'string') return null
  const text = raw.trim()
  if (!text) return null
  const at = new RegExp(`^${referencePattern().source}$`, 'i').exec(text)
  if (at) {
    const kind = at[1].toLowerCase()
    const id = stripRef(at[2] || at[3] || '')
    return kind && id ? { kind, id, ref: `${kind}/${id}` } : null
  }
  const slash = /^([a-z][a-z0-9._-]*)\/([^\s]+)$/i.exec(text)
  if (slash) {
    const kind = slash[1].toLowerCase()
    const id = stripRef(slash[2])
    return kind && id ? { kind, id, ref: `${kind}/${id}` } : null
  }
  return null
}

export function linkTagOf(ref: string): string {
  const parsed = parseLinkRef(ref)
  if (!parsed) return ref
  return /\s/.test(parsed.id) ? `@${parsed.kind}:"${parsed.id}"` : `@${parsed.kind}:${parsed.id}`
}

export function newRelationshipId(): string {
  return `rel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

export function cleanRelationship(raw: unknown): RelationshipEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const parsedLink = parseLinkRef(r.ref) ?? parseLinkRef(r.target)
  const rawTarget = typeof r.target === 'string' ? r.target.trim() : ''
  const target = parsedLink && rawTarget === (typeof r.ref === 'string' ? r.ref.trim() : rawTarget) && (parseLinkRef(rawTarget) !== null)
    ? showName(parsedLink.id)
    : rawTarget
  if (!target) return null
  const ref = parsedLink ? parsedLink.ref : null
  const inferred = parsedLink ? categoryForKind(parsedLink.kind) : 'concept'
  const category = cleanCategory(r.category, inferred)
  const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : newRelationshipId()
  const role = typeof r.role === 'string' ? r.role.trim() : ''
  const stance = cleanStance(r.stance)
  const affinity = cleanAffinity(r.affinity)
  const notes = typeof r.notes === 'string' ? r.notes.trim() : ''
  const secret = typeof r.secret === 'string' && r.secret.trim() ? r.secret.trim() : undefined
  const tags = cleanTags(r.tags)
  const pinned = r.pinned === true ? true : undefined
  const updatedAt = typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : Date.now()
  return {
    id,
    target,
    ...(ref ? { ref } : {}),
    category,
    role,
    stance,
    ...(affinity !== null ? { affinity } : {}),
    notes,
    ...(secret ? { secret } : {}),
    ...(tags ? { tags } : {}),
    ...(pinned ? { pinned } : {}),
    updatedAt
  }
}

export function cleanRelationships(raw: unknown): RelationshipEntry[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: RelationshipEntry[] = []
  for (const item of raw) {
    const entry = cleanRelationship(item)
    if (!entry || seen.has(entry.id)) continue
    seen.add(entry.id)
    out.push(entry)
  }
  return out
}

export interface RelationshipPatch {
  id?: string | null
  target?: string | null
  ref?: string | null
  category?: RelationCategory | null
  role?: string | null
  stance?: RelationStance | null
  affinity?: number | null
  notes?: string | null
  secret?: string | null
  tags?: string[] | null
  pinned?: boolean | null
}

function sameTarget(a: RelationshipEntry, target: string, ref: string | null): boolean {
  if (ref && a.ref && a.ref.toLowerCase() === ref.toLowerCase()) return true
  const tid = toId(target)
  return a.target.trim().toLowerCase() === target.trim().toLowerCase() || (tid !== '' && toId(a.target) === tid)
}

export type UpsertResult =
  | { ok: true; list: RelationshipEntry[]; entry: RelationshipEntry; created: boolean }
  | { ok: false; matches: RelationshipEntry[] }

export function upsertRelationship(list: RelationshipEntry[], patch: RelationshipPatch): UpsertResult {
  const id = patch.id?.trim() || null
  const parsedInputRef = parseLinkRef(patch.ref) ?? parseLinkRef(patch.target)
  const rawTarget = patch.target?.trim() ?? ''
  const target = parsedInputRef && parseLinkRef(rawTarget) ? showName(parsedInputRef.id) : rawTarget
  const ref = patch.ref === '' ? null : (parsedInputRef?.ref ?? null)

  let index = id ? list.findIndex((x) => x.id === id) : -1
  if (index < 0 && target) {
    const hits = list.filter(
      (x) => sameTarget(x, target, ref) && (!patch.category || x.category === patch.category)
    )
    if (hits.length > 1) return { ok: false, matches: hits }
    if (hits.length === 1) index = list.indexOf(hits[0])
  }

  const prev = index >= 0 ? list[index] : null
  const nextTarget = target || prev?.target || ''
  if (!nextTarget) return { ok: false, matches: [] }
  const nextRef = patch.ref === '' ? null : (ref ?? prev?.ref ?? null)
  const fallbackCategory = nextRef ? categoryForKind(parseLinkRef(nextRef)?.kind ?? '') : 'concept'
  const category = patch.category ? cleanCategory(patch.category) : (prev?.category ?? fallbackCategory)
  const nextEntry = cleanRelationship({
    id: prev?.id ?? id ?? newRelationshipId(),
    target: nextTarget,
    ...(nextRef ? { ref: nextRef } : {}),
    category,
    role: patch.role !== undefined && patch.role !== null ? patch.role : (prev?.role ?? ''),
    stance: patch.stance !== undefined && patch.stance !== null ? patch.stance : (prev?.stance ?? 'neutral'),
    affinity: patch.affinity !== undefined ? patch.affinity : (prev?.affinity ?? null),
    notes: patch.notes !== undefined && patch.notes !== null ? patch.notes : (prev?.notes ?? ''),
    secret: patch.secret !== undefined ? (patch.secret ?? '') : prev?.secret,
    tags: patch.tags !== undefined && patch.tags !== null ? patch.tags : prev?.tags,
    pinned: patch.pinned !== undefined && patch.pinned !== null ? patch.pinned : prev?.pinned,
    updatedAt: Date.now()
  })!

  const nextList = prev ? list.map((x, i) => (i === index ? nextEntry : x)) : [...list, nextEntry]
  return { ok: true, list: nextList, entry: nextEntry, created: !prev }
}

export type RemoveResult =
  | { ok: true; list: RelationshipEntry[]; removed: RelationshipEntry }
  | { ok: false; matches: RelationshipEntry[]; reason: 'not_found' | 'ambiguous' }

export function removeRelationship(
  list: RelationshipEntry[],
  targetOrId: string,
  category?: RelationCategory | null
): RemoveResult {
  const needle = targetOrId.trim()
  if (!needle) return { ok: false, matches: [], reason: 'not_found' }
  const byId = list.find((x) => x.id === needle)
  if (byId) return { ok: true, list: list.filter((x) => x.id !== byId.id), removed: byId }
  const parsedRef = parseLinkRef(needle)?.ref ?? null
  const matches = list.filter(
    (x) => sameTarget(x, needle, parsedRef) && (!category || x.category === category)
  )
  if (!matches.length) return { ok: false, matches: [], reason: 'not_found' }
  if (matches.length > 1) return { ok: false, matches, reason: 'ambiguous' }
  const removed = matches[0]
  return { ok: true, list: list.filter((x) => x.id !== removed.id), removed }
}

function tokenizeQuery(query: string): string[] {
  const phrases: string[] = []
  const rest = query.replace(/"([^"]+)"/g, (_m, phrase: string) => {
    const clean = phrase.trim().toLowerCase()
    if (clean) phrases.push(clean)
    return ' '
  })
  const words = rest
    .toLowerCase()
    .split(/[^\p{L}\p{N}_-]+/u)
    .filter((w) => w.length >= 2)
  return [...new Set([...phrases, ...words])]
}

function scoreField(terms: string[], raw: string, exactWeight: number, subWeight: number): number {
  const hay = raw.toLowerCase()
  if (!hay) return 0
  let total = 0
  for (const term of terms) {
    if (hay === term) total += exactWeight * 2
    else if (new RegExp(`(^|[^\\p{L}\\p{N}])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}\\p{N}]|$)`, 'u').test(hay)) total += exactWeight
    else if (hay.includes(term)) total += subWeight
  }
  return total
}

export function searchRelationships(
  list: RelationshipEntry[],
  query: string,
  opts?: { category?: RelationCategory | null; stance?: RelationStance | null; includePinned?: boolean; where?: string | null }
): { entry: RelationshipEntry; score: number }[] {
  const terms = tokenizeQuery(query)
  const where = opts?.where?.trim().toLowerCase() || ''
  const results: { entry: RelationshipEntry; score: number }[] = []

  for (const entry of list) {
    if (opts?.includePinned === false && entry.pinned) continue
    if (opts?.category && entry.category !== opts.category) continue
    if (opts?.stance && entry.stance !== opts.stance) continue
    if (where) {
      const placeHay = `${entry.target} ${entry.ref ?? ''} ${entry.notes}`.toLowerCase()
      if (!placeHay.includes(where)) continue
    }
    if (!terms.length) {
      results.push({ entry, score: (entry.pinned ? 2 : 1) + Math.abs(entry.affinity ?? 0) / 1000 })
      continue
    }
    const score =
      scoreField(terms, `${entry.target} ${entry.ref ?? ''}`, 7, 3) +
      scoreField(terms, `${entry.role} ${(entry.tags ?? []).join(' ')}`, 5, 2) +
      scoreField(terms, `${entry.category} ${entry.stance}`, 4, 1) +
      scoreField(terms, entry.notes, 2, 1)
    if (score > 0) results.push({ entry, score })
  }

  return results.sort((a, b) => b.score - a.score || b.entry.updatedAt - a.entry.updatedAt)
}

export function relationshipLine(entry: RelationshipEntry, opts?: { includeSecret?: boolean; includeRef?: boolean }): string {
  const aff = typeof entry.affinity === 'number' ? ` ${entry.affinity >= 0 ? `+${entry.affinity}` : entry.affinity}` : ''
  const link = opts?.includeRef !== false && entry.ref ? ` (${linkTagOf(entry.ref)})` : ''
  const detail = [entry.role, entry.notes].filter(Boolean).join(' — ')
  const secret = opts?.includeSecret && entry.secret ? ` [secret: ${entry.secret}]` : ''
  return `- [${entry.category} · ${entry.stance}${aff}] ${entry.target}${link}${detail ? `: ${detail}` : ''}${secret} (${entry.id})`
}

export function relationshipRagText(entry: RelationshipEntry): string {
  const aff = typeof entry.affinity === 'number' ? `affinity ${entry.affinity >= 0 ? `+${entry.affinity}` : entry.affinity}` : ''
  return [
    `${entry.target} (${entry.category})`,
    entry.ref ? `link ${linkTagOf(entry.ref)}` : '',
    entry.role ? `role: ${entry.role}` : '',
    `stance: ${entry.stance}${aff ? `, ${aff}` : ''}`,
    entry.tags?.length ? `tags: ${entry.tags.join(', ')}` : '',
    entry.notes ? `notes: ${entry.notes}` : ''
  ]
    .filter(Boolean)
    .join(' | ')
}

const SHORT_RELATIONS = 12

export function formatRelationshipsMarkdown(list: RelationshipEntry[], opts?: { pinnedOnly?: boolean; recallTool?: string }): string {
  if (!list.length) return ''
  const shown = opts?.pinnedOnly ? list.filter((x) => x.pinned) : list
  const rest = opts?.pinnedOnly ? list.filter((x) => !x.pinned).sort((a, b) => b.updatedAt - a.updatedAt) : []
  const aff = (entry: RelationshipEntry) => (typeof entry.affinity === 'number' ? ` ${entry.affinity >= 0 ? `+${entry.affinity}` : entry.affinity}` : '')
  const link = (entry: RelationshipEntry) => (entry.ref ? ` (${linkTagOf(entry.ref)})` : '')
  const lines = shown.map((entry) => {
    const role = entry.role ? `${entry.role}; ` : ''
    const note = entry.notes ? entry.notes : ''
    return `- **${entry.target}**${link(entry)} [${entry.category} · ${entry.stance}${aff(entry)}]: ${role}${note}`.replace(/: $/, '')
  })
  const brief = rest.slice(0, SHORT_RELATIONS).map((entry) => `- ${entry.target}${link(entry)} [${entry.category} · ${entry.stance}${aff(entry)}]${entry.role ? `: ${entry.role}` : ''}`)
  const more = rest.length - brief.length
  const notes = opts?.recallTool ? `notes via \`${opts.recallTool}\`` : ''
  const footer = [more > 0 ? `+${more} more` : '', notes].filter(Boolean).join('; ')
  lines.push(...brief)
  if (brief.length && footer) lines.push(`*(${footer})*`)
  return lines.join('\n')
}
