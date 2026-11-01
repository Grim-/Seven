import type { MapData } from '@shared/maps'
import { engine, main } from '../../lib/ipc'

export async function importMapFile(into: string | null, file?: string): Promise<MapData | null> {
  const readers = await engine('maps.readers')
  const path = file ?? (await main('dialog.openFile', { filters: readers.map((r) => ({ name: r.label, extensions: r.extensions })) }))
  return path ? engine('maps.import', { path, map: into }) : null
}
