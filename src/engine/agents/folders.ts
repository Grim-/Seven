import { FOLDER_TYPE, idSegment } from '@shared/ids'
import { data } from '../data/hub'
import { freeName } from '../library/packing'
import type { AgentFolders } from './registry'

const ROOT = 'agents'

function root(): string {
  const id = data.pages.makeFolders(ROOT)
  if (!id) throw new Error(`Could not make the ${ROOT} folder`)
  return id
}

function freeTitle(name: string, parent: string, except: string | null): string {
  return freeName(idSegment(name) || 'agent', (t) => Boolean(data.pages.taken(t, parent, except)), (n, i) => `${n}_${i}`)
}

export const agentFolders: AgentFolders = {
  make(name) {
    const parent = root()
    return data.pages.create({ title: freeTitle(name, parent, null), type: FOLDER_TYPE, parent }).id
  },
  rename(folder, name) {
    const meta = data.pages.metaFor(folder)
    if (!meta || meta.type !== FOLDER_TYPE) return
    const title = freeTitle(name, meta.parent ?? root(), folder)
    if (title !== meta.title) data.pages.write({ ref: folder, title })
  }
}

export function liveFolder(id: string | null | undefined): string | null {
  return id && data.pages.metaFor(id)?.type === FOLDER_TYPE ? id : null
}

export function removeFolderTree(folder: string): void {
  const ids = [folder]
  for (let i = 0; i < ids.length; i++) ids.push(...data.pages.children(ids[i]).map((p) => p.id))
  const inside = new Set(ids)
  for (const a of data.assets.list()) if (a.parent && inside.has(a.parent)) data.assets.delete(a.id)
  for (const id of ids.reverse()) data.pages.delete(id)
}
