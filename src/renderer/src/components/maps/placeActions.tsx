import { Dices, ExternalLink, Eraser, FolderOpen, MapPin, MessageSquarePlus, PenLine, Pencil, Play, Plus, Trash2, X } from 'lucide-react'
import { showName } from '@shared/ids'
import { placeId, type PlaceVisitor } from '@shared/maps'
import { PLACE_TYPE_KEY, type WorldEntity } from '@shared/world'
import { askText, confirmDelete, type MenuItem } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { openEntry } from '../../lib/library'
import { openSevenLink } from '../../lib/links'
import { startChatItems } from '../../views/data/entryMenu'
import { startDmChatWith } from '../../lib/conversation'
import { placeName } from './placeShapes'
import { newPlayItems, placePlay } from '../play/playHolder'

export function deletePlace(id: string, title: string, after?: () => void): void {
  confirmDelete(`Delete ${showName(title)}?`, 'Places inside it move up a level, and it comes off every map it is drawn on.', () => engine('library.remove', { entry: `place/${id}` }), after)
}

export function deletePlaceItem(id: string, title: string, after?: () => void): MenuItem {
  return { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => deletePlace(id, title, after) }
}

export async function setWhere(sheetId: string, placeKey: string | null): Promise<void> {
  const s = await engine('sheets.get', { id: sheetId })
  await engine('sheets.save', { id: s.id, title: s.title, fields: s.fields, values: s.values, dnd: s.dnd, story: { ...s.story, where: placeKey ? `@place:${placeKey}` : '' } })
}

export interface PlaceItemsContext {
  world: string
  placeKey: string
  places: Record<string, WorldEntity>
  here: PlaceVisitor[]
  shaped: boolean
  player: string | null
  onStart: (() => void) | null
  onNewInside: () => void
  onDraw: () => void
  onRemoveShape: () => void
  onDeleted: () => void
}

export function placeItems(c: PlaceItemsContext): MenuItem[] {
  const id = placeId(c.world, c.placeKey)
  const name = placeName(c.places, c.placeKey)
  return [
    ...(c.onStart ? [{ label: 'Start here', icon: <Play />, onSelect: c.onStart }] : []),
    { label: 'Continue here', icon: <MessageSquarePlus />, children: startChatItems(`@place:${c.placeKey}`, c.here.flatMap((v) => (v.agent ? [v.agent] : []))) },
    { label: 'Start DM chat here', icon: <Dices />, children: startChatItems(`@place:${c.placeKey}`, c.here.flatMap((v) => (v.agent ? [v.agent] : [])), startDmChatWith) },
    ...newPlayItems(placePlay(c.world, c.placeKey, c.places[c.placeKey] ?? {}, c.player, c.here.flatMap((v) => (v.agent ? [v.agent] : [])))),
    { label: 'New place inside', icon: <Plus />, onSelect: c.onNewInside },
    { label: c.shaped ? 'Redraw shape' : 'Draw shape', icon: <PenLine />, onSelect: c.onDraw },
    ...(c.shaped ? [{ label: 'Remove shape', icon: <Eraser />, onSelect: c.onRemoveShape }] : []),
    {
      label: 'Rename',
      icon: <Pencil />,
      onSelect: () =>
        askText(`Rename ${name}`, 'Name', name, async (next) => {
          if (next.trim()) await engine('worlds.put', { id: c.world, type: PLACE_TYPE_KEY, key: c.placeKey, entity: { Name: next.trim() } }).catch(failed('Could not rename'))
        })
    },
    { label: 'Open record', icon: <ExternalLink />, onSelect: () => openEntry('place', id) },
    deletePlaceItem(id, name, c.onDeleted)
  ]
}

export function characterItems(visitor: PlaceVisitor, places: Record<string, WorldEntity>, at: string | null): MenuItem[] {
  const move = (key: string | null) => () => void setWhere(visitor.sheet, key).catch(failed(key ? 'Could not move them' : 'Could not remove them'))
  return [
    { label: 'Open sheet', icon: <FolderOpen />, onSelect: () => openSevenLink(`seven:sheet/${encodeURIComponent(visitor.sheet)}`) },
    {
      label: 'Move to',
      icon: <MapPin />,
      children: Object.keys(places)
        .filter((k) => k !== at)
        .sort((a, b) => placeName(places, a).localeCompare(placeName(places, b)))
        .map((k) => ({ label: placeName(places, k), onSelect: move(k) }))
    },
    { label: 'Remove from here', icon: <X />, danger: true, onSelect: move(null) }
  ]
}
