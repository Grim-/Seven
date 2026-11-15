import type { Avatar } from '@shared/avatars'
import type { AvatarPose } from '@shared/moods'
import { LiveAvatar } from '../LiveAvatar'

const SIZES = [16, 28, 64]

export function SizeStrip({ avatar, pose }: { avatar: Avatar; pose?: AvatarPose }) {
  return (
    <div className="flex items-end gap-3">
      {SIZES.map((size) => (
        <span key={size} className="flex flex-col items-center gap-1">
          <LiveAvatar avatar={avatar} pose={pose} size={size} />
          <span className="font-mono text-[9.5px] text-faint">{size}px</span>
        </span>
      ))}
    </div>
  )
}
