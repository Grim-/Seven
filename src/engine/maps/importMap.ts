import path from 'node:path'
import type { MapData } from '@shared/maps'
import { data } from '../data/hub'
import { maps } from './store'
import { readerFor } from './mapReaders'
import './tiled'

export function importMap(file: string, into: string | null): MapData {
  const existing = into ? maps.get(into) : null
  const name = existing?.name ?? path.basename(file, path.extname(file))
  const folder = data.pages.makeFolders(`maps/${name}`)
  const store = (source: string) => {
    const added = data.assets.register(source, { tool: null, sessionId: null, original: source })
    return (folder ? data.assets.move(added.id, folder) : added).id
  }
  const content = readerFor(file).read(file, store)
  return existing ? maps.save({ ...existing, ...content }) : maps.create(name, content)
}
