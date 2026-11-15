import type { Avatar } from '@shared/avatars'
import type { AvatarPose } from '@shared/moods'
import { AvatarCanvas } from './AvatarCanvas'
import { useAvatarSignals } from './useAvatarSignals'

export function AvatarArt({ avatar, sessionId = null, pose }: { avatar: Avatar; sessionId?: string | null; pose?: AvatarPose }) {
  const source = useAvatarSignals(sessionId, pose)
  return <AvatarCanvas avatar={avatar} source={source} />
}
