import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'

export function useWorldPlayer(world: string | null): string | null {
  const list = useLive(() => engine('worlds.list'), 'worlds.changed')
  return world ? (list?.find((w) => w.id === world)?.player ?? null) : null
}
