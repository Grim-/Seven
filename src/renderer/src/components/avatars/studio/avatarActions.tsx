import { Copy, Trash2 } from 'lucide-react'
import type { Avatar } from '@shared/avatars'
import type { MenuItem } from '../../ui'
import type { AvatarDraftState } from './useAvatarDraft'

export function copyAvatarItem(studio: AvatarDraftState, avatar: Avatar): MenuItem {
  return { label: 'Copy', icon: <Copy />, hint: 'Make an editable copy', onSelect: () => studio.copy(avatar) }
}

export function avatarActions(studio: AvatarDraftState, avatar: Avatar): MenuItem[] {
  const remove: MenuItem = { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => studio.remove(avatar) }
  return [copyAvatarItem(studio, avatar), ...(avatar.builtin ? [] : [remove])]
}
