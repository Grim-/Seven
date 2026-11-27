import { Dices, ExternalLink, FolderOpen, MapPin, MessageSquarePlus, PenLine, Pencil, Play, Plus, Trash2, X } from 'lucide-react'
import { showName } from '@shared/ids'
import { placeId, type PlaceVisitor, type WorldMapUse } from '@shared/maps'
import { smallestAt, type Point } from '@shared/shapes'
import { PLACE_TYPE_KEY, type WorldEntity } from '@shared/world'
import { actorEntry, splitNpcRef } from '@shared/worldNpcs'
import { askText, confirmDelete, type MenuItem } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { openEntry } from '../../lib/library'
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

/**
 * Synchronizes a token's recorded `story.where` with its exact spatial position on the map
 * without teleporting it:
 *   1. Inside a Place zone -> `@world:<world>/place/<placeKey>`
 *   2. Outside Places, inside a Region zone -> `@world:<world>/region/<regionKey>`
 *   3. Outside all Places & Regions -> `'Wilderness'`
 */
export async function syncTokenLocation(
  sheetId: string,
  worldId: string,
  use: WorldMapUse,
  at: Point
): Promise<{ placeKey: string | null; regionKey: string | null; label: string }> {
  const placeKey = smallestAt(use.shapes, at)
  const regionKey = !placeKey ? smallestAt(use.regionShapes ?? {}, at) : null
  const where = placeKey
    ? `@world:${worldId}/place/${placeKey}`
    : regionKey
      ? `@world:${worldId}/region/${regionKey}`
      : 'Wilderness'

  const npc = splitNpcRef(sheetId)
  if (npc) {
    const existing = await engine('npcs.get', { id: npc.id, world: npc.world, layer: 'play' })
    if (existing && existing.story.where !== where) {
      await engine('npcs.save', {
        world: npc.world,
        previousId: npc.id,
        npc: { ...existing, story: { ...existing.story, where } }
      })
    }
  } else {
    const s = await engine('sheets.get', { id: sheetId })
    if (s.story.where !== where) {
      await engine('sheets.save', {
        id: s.id,
        title: s.title,
        fields: s.fields,
        values: s.values,
        dnd: s.dnd,
        story: { ...s.story, where }
      })
    }
  }
  return { placeKey, regionKey, label: placeKey ?? regionKey ?? 'Wilderness' }
}

export async function setWhere(sheetId: string, placeKey: string | null, worldId?: string | null): Promise<void> {
  const npc = splitNpcRef(sheetId)
  if (npc) {
    const resolvedWorld = worldId ?? npc.world
    const where = placeKey ? `@world:${resolvedWorld}/place/${placeKey}` : 'Wilderness'
    const existing = await engine('npcs.get', { id: npc.id, world: resolvedWorld, layer: 'play' })
    if (existing) {
      await engine('npcs.save', {
        world: resolvedWorld,
        previousId: npc.id,
        npc: { ...existing, story: { ...existing.story, where } }
      })
    }
    if (placeKey) {
      const uses = await engine('worlds.maps', { id: resolvedWorld })
      const targetMap = (uses.find((u) => Boolean(u.shapes[placeKey])) ?? uses[0])?.map
      if (targetMap) {
        await engine('worlds.moveCharacter', { sheet: sheetId, world: resolvedWorld, map: targetMap, place: placeKey })
      }
    }
    return
  }

  const s = await engine('sheets.get', { id: sheetId })
  const resolvedWorld = worldId ?? (await engine('worlds.ofSheet', { sheet: sheetId }))
  const where = placeKey
    ? resolvedWorld
      ? `@world:${resolvedWorld}/place/${placeKey}`
      : `@place:${placeKey}`
    : 'Wilderness'
  await engine('sheets.save', { id: s.id, title: s.title, fields: s.fields, values: s.values, dnd: s.dnd, story: { ...s.story, where } })
  if (placeKey && resolvedWorld) {
    const uses = await engine('worlds.maps', { id: resolvedWorld })
    const targetMap = (uses.find((u) => Boolean(u.shapes[placeKey])) ?? uses[0])?.map
    if (targetMap) {
      await engine('worlds.moveCharacter', { sheet: s.id, world: resolvedWorld, map: targetMap, place: placeKey })
    }
  }
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
    { label: 'Continue here', icon: <MessageSquarePlus />, children: startChatItems(`@world:${c.world}/place/${c.placeKey}`, c.here.flatMap((v) => (v.agent ? [v.agent] : []))) },
    { label: 'Start DM chat here', icon: <Dices />, children: startChatItems(`@world:${c.world}/place/${c.placeKey}`, c.here.flatMap((v) => (v.agent ? [v.agent] : [])), startDmChatWith) },
    ...newPlayItems(placePlay(c.world, c.placeKey, c.places[c.placeKey] ?? {}, c.player, c.here.flatMap((v) => (v.agent ? [v.agent] : [])))),
    { label: 'New place inside', icon: <Plus />, onSelect: c.onNewInside },
    { label: c.shaped ? 'Redraw zone' : 'Draw zone', icon: <PenLine />, onSelect: c.onDraw },
    {
      label: 'Rename',
      icon: <Pencil />,
      onSelect: () =>
        askText(`Rename ${name}`, 'Name', name, async (next) => {
          if (next.trim()) await engine('worlds.put', { id: c.world, type: PLACE_TYPE_KEY, key: c.placeKey, entity: { Name: next.trim() } }).catch(failed('Could not rename'))
        })
    },
    { label: 'Open record', icon: <ExternalLink />, onSelect: () => openEntry('world', `${c.world}/place/${c.placeKey}`) },
    deletePlaceItem(id, name, c.onDeleted)
  ]
}

export function characterItems(visitor: PlaceVisitor, places: Record<string, WorldEntity>, at: string | null, worldId?: string | null): MenuItem[] {
  const move = (key: string | null) => () => void setWhere(visitor.sheet, key, worldId).catch(failed(key ? 'Could not move them' : 'Could not remove them'))
  const entry = actorEntry(visitor.sheet)
  return [
    { label: 'Open sheet', icon: <FolderOpen />, onSelect: () => openEntry(entry.kind, entry.id) },
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
