import { ACTIVITIES, MOODS, REACTION_POSES } from '../moods'

export type AvatarSize = 'dot' | 'badge' | 'portrait' | 'stage'

export const AVATAR_SIZES: { size: AvatarSize; label: string; below: number }[] = [
  { size: 'dot', label: 'Dot', below: 20 },
  { size: 'badge', label: 'Badge', below: 48 },
  { size: 'portrait', label: 'Portrait', below: 160 },
  { size: 'stage', label: 'Stage', below: Infinity }
]

export function avatarSizeOf(px: number): AvatarSize {
  return (AVATAR_SIZES.find((s) => px < s.below) ?? AVATAR_SIZES[AVATAR_SIZES.length - 1]).size
}

export function sizeRank(size: string): number {
  return AVATAR_SIZES.findIndex((s) => s.size === size)
}

export const POSE_KEYS: string[] = [...new Set<string>([...MOODS.map((m) => m.name), ...ACTIVITIES.map((a) => a.name), ...REACTION_POSES.map((r) => r.name)])]
