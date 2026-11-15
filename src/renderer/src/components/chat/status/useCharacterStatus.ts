import { engine } from '../../../lib/ipc'
import { useLive } from '../../../lib/useLive'
import { useModuleList } from '../../../registries/useModuleList'
import { statusSources, type CharacterStatus } from './characterStatus'

export function useCharacterStatus(sheet: string | null): CharacterStatus | null {
  const data = useLive(() => (sheet ? engine('sheets.get', { id: sheet }) : Promise.resolve(null)), 'page.changed', [sheet])
  const sources = useModuleList(statusSources)
  if (!sheet || !data || !sources) return null
  const reads = sources.map((s) => s.read(data))
  const health = reads.find((r) => r.health)?.health ?? null
  const effects = reads.flatMap((r) => r.effects ?? [])
  if (!health && !effects.length) return null
  return { name: data.title, health, effects }
}
