import { AVATAR_SIZES, type Avatar, type TreatmentEntry } from '@shared/avatars'

export function wearing(avatar: Avatar, entry: TreatmentEntry): Avatar {
  return { ...avatar, id: `${avatar.id}:${entry.key}`, treatments: [{ ...entry, settings: { ...entry.settings, from: AVATAR_SIZES[0].size } }] }
}
