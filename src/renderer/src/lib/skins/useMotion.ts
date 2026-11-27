import type { LookMotion } from '@shared/themeLook'
import { useThemes } from '../../store/themes'

export function useMotion(): LookMotion {
  return useThemes((s) => s.active.motion)
}
