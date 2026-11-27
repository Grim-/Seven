import type { Avatar } from '@shared/avatars'
import type { AvatarPose } from '@shared/moods'
import { cn } from '../../../lib/cn'
import { LiveAvatar } from '../LiveAvatar'

const SIZES = [16, 28, 64]

export function SizeStrip({ avatar, pose, className }: { avatar: Avatar; pose?: AvatarPose; className?: string }) {
  return (
    <div className={cn('flex items-end gap-3', className)}>
      {SIZES.map((size) => (
        <span key={size} title={`${size}px`} className="flex">
          <LiveAvatar avatar={avatar} pose={pose} size={size} />
        </span>
      ))}
    </div>
  )
}
