import { useMemo } from 'react'
import { avatarOfRef, type Avatar } from '@shared/avatars'
import type { AgentProfile } from '@shared/types'
import { useAvatars } from '../../store/avatars'

export function useAgentAvatar(agent: AgentProfile | null | undefined): Avatar | null {
  const list = useAvatars((s) => s.list)
  const ref = agent?.look.avatar
  return useMemo(() => avatarOfRef(ref, list), [ref, list])
}
