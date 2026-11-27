import { stackBleed, type Avatar } from '@shared/avatars'
import type { AvatarPose } from '@shared/moods'
import type { VfxCue } from '../../store/vfx'
import { cn } from '../../lib/cn'
import { VfxFrame } from '../vfx'
import { AvatarArt } from './AvatarArt'

export function LiveAvatar({ avatar, pose, size, target, vfx, className }: { avatar: Avatar; pose?: AvatarPose; size?: number; target?: string | string[] | null; vfx?: VfxCue | null; className?: string }) {
  return (
    <VfxFrame target={target ?? `avatar:${avatar.id}`} cue={vfx} style={size ? { width: size, height: size } : undefined} className={cn('relative shrink-0 border border-accent/60 bg-panel', stackBleed(avatar.treatments) > 0 ? 'overflow-visible' : 'overflow-hidden', className)}>
      <AvatarArt avatar={avatar} pose={pose} />
    </VfxFrame>
  )
}
