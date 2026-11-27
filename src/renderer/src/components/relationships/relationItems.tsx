import { ExternalLink, Link2, Network, Pin, Trash2 } from 'lucide-react'
import { linkTagOf, parseLinkRef, stanceMeta, type RelationStance, type RelationshipEntry } from '@shared/relationships'
import type { MenuItem } from '../ui'
import { copyText } from '../../lib/notify'
import { openEntry, openEntryAt, opensAt } from '../../lib/library'
import { STANCE_UIS } from './styles'

export const RELATIONS = 'relations'

export function withStance(entry: RelationshipEntry, stance: RelationStance): RelationshipEntry {
  return { ...entry, stance, ...(typeof entry.affinity === 'number' ? { affinity: stanceMeta(stance).defaultAffinity } : {}), updatedAt: Date.now() }
}

export function stanceItems(entry: RelationshipEntry, update: (next: RelationshipEntry) => void): MenuItem[] {
  return STANCE_UIS.map((s) => ({ label: `${s.id === entry.stance ? '✓ ' : ''}${s.label}`, onSelect: () => update(withStance(entry, s.id)) }))
}

export function relationItems(entry: RelationshipEntry, edit: { update: (next: RelationshipEntry) => void; remove: () => void; editItem?: MenuItem } | null, extra: MenuItem[] = []): MenuItem[] {
  const parsed = entry.ref ? parseLinkRef(entry.ref) : null
  return [
    ...(parsed ? [{ label: `Open ${entry.target}`, icon: <ExternalLink />, onSelect: () => openEntry(parsed.kind, parsed.id) }] : []),
    ...(parsed && opensAt(parsed.kind, RELATIONS) ? [{ label: `${entry.target}'s relations`, icon: <Network />, onSelect: () => openEntryAt(parsed.kind, parsed.id, RELATIONS) }] : []),
    ...(entry.ref ? [{ label: 'Copy @link', icon: <Link2 />, onSelect: () => copyText(linkTagOf(entry.ref!), 'Link copied') }] : []),
    ...(edit
      ? [
          ...(edit.editItem ? [edit.editItem] : []),
          { label: 'Set stance', children: stanceItems(entry, edit.update) },
          { label: entry.pinned ? 'Unpin from prompt' : 'Pin to prompt', icon: <Pin />, onSelect: () => edit.update({ ...entry, pinned: entry.pinned ? undefined : true, updatedAt: Date.now() }) },
          ...extra,
          { label: 'Remove', icon: <Trash2 />, danger: true, onSelect: edit.remove }
        ]
      : extra)
  ]
}
