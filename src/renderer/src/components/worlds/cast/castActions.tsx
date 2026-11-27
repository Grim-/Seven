import {
  ArrowUpRight,
  Copy,
  Download,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus
} from 'lucide-react'
import { showName } from '@shared/ids'
import type { WorldEntity } from '@shared/world'
import { confirmDelete, type MenuItem } from '../../ui'
import { engine } from '../../../lib/ipc'
import { openEntry } from '../../../lib/library'
import { failed } from '../../../lib/notify'
import { toast } from '../../../store/toasts'
import { placeName } from '../../maps/placeShapes'
import { setWhere } from '../../maps/placeActions'
import type { CastMember } from './castTypes'

export interface CastActionCallbacks {
  worldId: string
  worldName: string
  saveId: string | null
  partyIds: string[]
  places: Record<string, WorldEntity>
  onSelectActor?: (actorId: string | null) => void
  onOpenStamp?: (member: CastMember) => void
}

export function castMemberExtraMenuItems(member: CastMember, ctx: CastActionCallbacks): MenuItem[] {
  const items: MenuItem[] = []
  const displayName = showName(member.title)
  const inParty = ctx.partyIds.includes(member.actorId)

  if (!member.archetype) {
    if (member.roleKind !== 'player') {
      items.push({
        label: 'Play As (Set Protagonist)',
        icon: <UserCheck />,
        onSelect: () =>
          void engine('worlds.setPlayer', { id: ctx.worldId, sheet: member.actorId })
            .then(() => toast.success('Protagonist Set', `${displayName} is now the active character.`))
            .catch(failed('Could not set active character'))
      })
    }

    if (ctx.saveId) {
      items.push(
        inParty
          ? {
              label: 'Dismiss from Party',
              icon: <UserMinus />,
              onSelect: () =>
                void engine('saves.removePartyMember', { id: ctx.saveId!, sheet: member.actorId })
                  .then(() => toast.info('Left Party', `${displayName} left your party and remains in the world.`))
                  .catch(failed('Could not update party'))
            }
          : {
              label: 'Recruit to Party',
              icon: <UserPlus />,
              onSelect: () =>
                void engine('saves.addPartyMember', { id: ctx.saveId!, sheet: member.actorId, place: member.placeKey, map: member.mapId })
                  .then(() => toast.success('Joined Party', `${displayName} joined your party.`))
                  .catch(failed('Could not recruit into party'))
            }
      )
    }

    const placeKeys = Object.keys(ctx.places)
    if (placeKeys.length > 0) {
      items.push({
        label: 'Move / Station at',
        children: [
          ...(member.placeKey
            ? [
                {
                  label: 'Take Off-Stage (Unstationed)',
                  onSelect: () =>
                    void setWhere(member.actorId, null, ctx.worldId).catch(failed('Could not take off-stage'))
                }
              ]
            : []),
          ...placeKeys
            .filter((k) => k !== member.placeKey)
            .sort((a, b) => placeName(ctx.places, a).localeCompare(placeName(ctx.places, b)))
            .map((k) => ({
              label: placeName(ctx.places, k),
              onSelect: () =>
                void setWhere(member.actorId, k, ctx.worldId).catch(failed('Could not move character'))
            }))
        ]
      })
    }
  }

  if (member.isWorldNpc && member.npcId) {
    const npcId = member.npcId

    items.push({
      label: member.archetype ? 'Stamp Individual into Save…' : 'Stamp Copy into Save…',
      icon: <Sparkles />,
      onSelect: () => {
        ctx.onOpenStamp?.(member)
      }
    })

    if (member.hasOverrides) {
      items.push({
        label: member.hasTemplate ? 'Write Save State to World Template' : 'Save into World Template (Unique NPC)',
        icon: <Save />,
        onSelect: () =>
          void engine('npcs.writeToTemplate', { world: ctx.worldId, id: npcId, asArchetype: false })
            .then(() =>
              toast.success(
                'Saved to World Template',
                `${displayName}'s current state is now part of ${ctx.worldName}'s baseline.`
              )
            )
            .catch(failed('Could not write NPC to world template'))
      })
    }

    if (member.hasOverrides && member.hasTemplate) {
      items.push({
        label: 'Revert Save Overrides to Template',
        icon: <RotateCcw />,
        onSelect: () =>
          void engine('npcs.resetInSave', { world: ctx.worldId, id: npcId })
            .then(() => toast.info('Reverted to Template', `${displayName} was restored to the world baseline.`))
            .catch(failed('Could not reset NPC in save'))
      })
    }

    items.push({
      label: 'Character Library Conversions',
      icon: <ArrowUpRight />,
      children: [
        {
          label: 'Promote to Standalone Character (Move)',
          icon: <ArrowUpRight />,
          onSelect: () =>
            void engine('npcs.promoteToSheet', { world: ctx.worldId, id: npcId })
              .then((sheet) => {
                ctx.onSelectActor?.(sheet.id)
                toast.success(
                  'Promoted to Character',
                  `${showName(sheet.title)} is now a standalone Character sheet and replaced the World NPC.`,
                  { label: 'Open Sheet', onSelect: () => openEntry('sheet', sheet.id) }
                )
              })
              .catch(failed('Could not promote NPC to character'))
        },
        {
          label: 'Save Independent Copy to Characters',
          icon: <Copy />,
          onSelect: () =>
            void engine('npcs.copyToSheet', { world: ctx.worldId, id: npcId, layer: 'play' })
              .then((sheet) =>
                toast.success(
                  'Saved Copy to Characters',
                  `${showName(sheet.title)} was copied to your Characters library.`,
                  { label: 'Open Copy', onSelect: () => openEntry('sheet', sheet.id) }
                )
              )
              .catch(failed('Could not copy NPC to character sheet'))
        }
      ]
    })

    if (!member.hasTemplate) {
      items.push({
        label: 'Remove from Save',
        icon: <Trash2 />,
        danger: true,
        onSelect: () =>
          confirmDelete(
            `Remove ${displayName} from this save?`,
            'This stamped NPC only exists in the active save and will be removed.',
            () => engine('npcs.delete', { world: ctx.worldId, id: npcId, saveOnly: true }),
            () => ctx.onSelectActor?.(null),
            'Remove'
          )
      })
    } else if (ctx.saveId && !member.archetype) {
      items.push({
        label: 'Remove from Active Save Only',
        icon: <UserMinus />,
        danger: true,
        onSelect: () =>
          confirmDelete(
            `Remove ${displayName} from this save?`,
            `They will leave the current playthrough, while their baseline template stays intact in ${ctx.worldName}.`,
            () => engine('npcs.delete', { world: ctx.worldId, id: npcId, saveOnly: true }),
            () => ctx.onSelectActor?.(null),
            'Remove from Save'
          )
      })
    }
  } else {
    items.push({
      label: 'World NPC Conversions',
      icon: <Download />,
      children: [
        {
          label: `Copy into ${ctx.worldName} as Unique NPC`,
          icon: <Copy />,
          onSelect: () =>
            void engine('npcs.copyFromSheet', {
              world: ctx.worldId,
              sheet: member.actorId,
              archetype: false,
              place: member.placeKey,
              faction: member.faction
            })
              .then((npc) =>
                toast.success(
                  'Copied as World NPC',
                  `${showName(npc.title)} now has an independent World NPC copy inside ${ctx.worldName}.`,
                  { label: 'Select NPC', onSelect: () => ctx.onSelectActor?.(`${ctx.worldId}/npc/${npc.id}`) }
                )
              )
              .catch(failed('Could not copy sheet into world'))
        },
        {
          label: `Copy into ${ctx.worldName} as Archetype`,
          icon: <Sparkles />,
          onSelect: () =>
            void engine('npcs.copyFromSheet', {
              world: ctx.worldId,
              sheet: member.actorId,
              archetype: true,
              faction: member.faction
            })
              .then((npc) =>
                toast.success(
                  'Saved as World Archetype',
                  `${showName(npc.title)} is now a reusable Archetype in ${ctx.worldName}.`,
                  { label: 'Select Archetype', onSelect: () => ctx.onSelectActor?.(`${ctx.worldId}/npc/${npc.id}`) }
                )
              )
              .catch(failed('Could not copy sheet as archetype'))
        }
      ]
    })

    items.push({
      label: 'Leave World',
      icon: <Trash2 />,
      danger: true,
      onSelect: () =>
        confirmDelete(
          `Take ${displayName} out of ${ctx.worldName}?`,
          'They will leave the map and active save, while their standalone Character sheet stays untouched in your library.',
          () => engine('worlds.removeCharacter', { sheet: member.actorId }),
          () => ctx.onSelectActor?.(null),
          'Take Out'
        )
    })
  }

  return items
}
