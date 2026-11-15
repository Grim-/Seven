import type { Avatar } from '@shared/avatars'
import type { BaseAvatar } from './BaseAvatar'
import type { SignalSource } from './signals'

export type AvatarMaker = new (avatar: Avatar, source: SignalSource) => BaseAvatar

const makers = new Map<string, AvatarMaker>()

export function registerAvatarDrawer(renderer: string, maker: AvatarMaker): void {
  makers.set(renderer, maker)
}

export function avatarDrawer(renderer: string): AvatarMaker | null {
  return makers.get(renderer) ?? null
}
