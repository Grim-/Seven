import type { ServerBuild } from '@shared/types'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'

export function useServerBuild(): ServerBuild | null {
  return useLive(() => engine('server.build'), 'install.changed')
}
