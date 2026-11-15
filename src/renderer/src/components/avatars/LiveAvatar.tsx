import type { Avatar } from '@shared/avatars'
import type { AvatarPose } from '@shared/moods'
import { cn } from '../../lib/cn'
import { AvatarArt } from './AvatarArt'

export function LiveAvatar({ avatar, pose, size, className }: { avatar: Avatar; pose?: AvatarPose; size?: number; className?: string }) {
  return (
    <div style={size ? { width: size, height: size } : undefined} className={cn('relative shrink-0 overflow-hidden border border-accent/60 bg-black', className)}>
      <AvatarArt avatar={avatar} pose={pose} />
    </div>
  )
}
