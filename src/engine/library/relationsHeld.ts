import { isNotFound, notFound } from '@shared/errors'
import { cleanRelationship, parseLinkRef, type RelationshipEntry } from '@shared/relationships'
import { resolveEntry, USER } from './kinds'
import type { KindRelations } from './defs/types'

interface Held {
  held: KindRelations
  id: string
  ref: string
}

function heldAt(ref: string): Held | null {
  const parsed = parseLinkRef(ref)
  if (!parsed) return null
  try {
    const { kind, id } = resolveEntry(parsed.ref, null, USER)
    return kind.relations ? { held: kind.relations, id, ref: `${kind.kind}/${id}` } : null
  } catch (err) {
    if (isNotFound(err)) return null
    throw err
  }
}

export function relationBacks(owner: string, refs: string[]): Record<string, RelationshipEntry | null> {
  const self = heldAt(owner)?.ref ?? parseLinkRef(owner)?.ref ?? owner
  return Object.fromEntries(
    refs.flatMap((ref) => {
      const at = heldAt(ref)
      if (!at || at.ref === self) return []
      return [[ref, at.held.list(at.id).find((r) => r.ref === self) ?? null]]
    })
  )
}

export function putRelation(holder: string, entry: RelationshipEntry): RelationshipEntry[] {
  const at = heldAt(holder)
  if (!at) throw notFound(new Error(`${holder} can't hold relationships.`))
  const clean = cleanRelationship({ ...entry, updatedAt: Date.now() })
  if (!clean) throw new Error('The relationship needs a target.')
  const list = at.held.list(at.id)
  const next = list.some((r) => r.id === clean.id) ? list.map((r) => (r.id === clean.id ? clean : r)) : [...list, clean]
  at.held.save(at.id, next)
  return next
}
