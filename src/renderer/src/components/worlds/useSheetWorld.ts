import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'

export function useSheetWorld(sheet: string | null | undefined): string | null {
  return useLive(() => (sheet ? engine('worlds.ofSheet', { sheet }) : Promise.resolve(null)), ['worlds.changed', 'saves.changed'], [sheet])
}
