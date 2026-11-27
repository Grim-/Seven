import type { SkyPhase } from '../theme'
import type { LookSky } from '../themeLook'

export const DEFAULT_SKIES: Record<SkyPhase, LookSky> = {
  dawn: { orb: '#ffb27a' },
  day: { orb: '#fff1c9' },
  dusk: { orb: '#ff7a3d' },
  night: { orb: '#d6defa' }
}
