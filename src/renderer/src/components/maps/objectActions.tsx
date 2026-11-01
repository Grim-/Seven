import { ExternalLink, MessageSquarePlus, Pencil, Trash2 } from 'lucide-react'
import { parseActions } from '@shared/actions'
import { parseDecisions } from '@shared/decisions'
import type { ObjectLayerData } from '@shared/maps'
import type { MouseEvent } from 'react'
import { confirmDelete, openMenu, type MenuItem } from '../ui'
import type { MapObjectHandlers } from './mapObjects'
import { openEntry } from '../../lib/library'
import { startChatItems } from '../../views/data/entryMenu'
import { actionItems, decisionItems, newPlayItems, type PlayHolder } from '../play/playHolder'
import { worldWhere } from '../play/playStore'

export function entryOf(object: ObjectLayerData): { kind: string; id: string } | null {
  if (!object.entry) return null
  const at = object.entry.indexOf(':')
  return at > 0 ? { kind: object.entry.slice(0, at), id: object.entry.slice(at + 1) } : null
}

export function objectPlay(object: ObjectLayerData, mapId: string, character: string | null, agents: string[], onChange: ((next: ObjectLayerData) => void) | null, world?: string): PlayHolder {
  return {
    texts: { action: object.actions, decision: object.decisions },
    save: async (kind, text) => onChange?.({ ...object, ...(kind === 'action' ? { actions: text } : { decisions: text }) }),
    keepLabel: 'Keep on this object',
    character,
    where: worldWhere(`${object.name} on @map:${mapId}`, agents, world, character)
  }
}

export function objectHandlers(world: string, mapId: string, character: string | null): MapObjectHandlers {
  const open = (object: ObjectLayerData, e: MouseEvent) => openMenu(e, object.name, objectItems(object, objectPlay(object, mapId, character, [], null, world), null))
  return { onPick: open, onMenu: open }
}

export interface ObjectEdit {
  onEdit: () => void
  onDelete: () => void
}

export function objectItems(object: ObjectLayerData, play: PlayHolder, edit: ObjectEdit | null): MenuItem[] {
  const entry = entryOf(object)
  return [
    { label: 'Continue here', icon: <MessageSquarePlus />, children: startChatItems(play.where.link ?? object.name, play.where.agents) },
    ...parseActions(object.actions).map((a, i) => ({ ...actionItems(play, a, i)[0], label: a.attempt })),
    ...parseDecisions(object.decisions).map((d, i) => ({ ...decisionItems(play, d, i, null)[0], label: d.question })),
    ...(entry ? [{ label: 'Open', icon: <ExternalLink />, onSelect: () => openEntry(entry.kind, entry.id) }] : []),
    ...(edit
      ? [
          ...newPlayItems(play),
          { label: 'Edit', icon: <Pencil />, onSelect: edit.onEdit },
          { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => confirmDelete(`Delete ${object.name}?`, 'It comes off this map, with its actions and decisions. Its picture stays in your files.', async () => edit.onDelete()) }
        ]
      : [])
  ]
}
