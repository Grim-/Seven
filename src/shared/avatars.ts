import './avatars/glyph'
import './avatars/lattice'
import './avatars/picture'
import './avatars/treatments'
import { pictureAvatar } from './avatars/picture'
import type { Avatar } from './avatars/registry'
import type { AvatarRef } from './types'

export * from './avatars/registry'
export * from './avatars/treatments'
export { PICTURE_RENDERER, pictureAvatar } from './avatars/picture'

export function avatarOfRef(ref: AvatarRef | null | undefined, list: Avatar[]): Avatar | null {
  const file = fileOfRef(ref)
  if (file) return pictureAvatar(file)
  const id = avatarIdOfRef(ref)
  return id ? (list.find((a) => a.id === id) ?? null) : null
}

export function avatarIdOfRef(ref: AvatarRef | null | undefined): string | null {
  if (!ref || ref.kind === 'file') return null
  return ref.kind === 'avatar' ? ref.id : ref.type
}

export function fileOfRef(ref: AvatarRef | null | undefined): string | null {
  return ref?.kind === 'file' ? ref.assetId : null
}
