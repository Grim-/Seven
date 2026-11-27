import { ASSET_IDS_IN } from '@shared/ids'
import type { AssetMeta } from '@shared/types'
import { kindNamed } from '../library/kinds'
import { data } from './hub'

export interface Arrived {
  meta: AssetMeta
  owner: string | null
}

export function ownerOf(id: string, entries: { kind: string; value: unknown }[]): string | null {
  return entries.find((e) => ((JSON.stringify(e.value) ?? '').match(ASSET_IDS_IN) ?? ([] as string[])).includes(id))?.kind ?? null
}

export function freshFiles(): (meta: AssetMeta) => boolean {
  const before = new Set(data.assets.list().map((a) => a.id))
  return (meta) => !before.has(meta.id)
}

function folderPath(file: Arrived, pictureFolder: string | null | undefined): string {
  const picture = file.meta.kind === 'image'
  if (picture && typeof pictureFolder === 'string') return pictureFolder
  const group = (file.owner && kindNamed(file.owner)?.plural.toLowerCase()) || 'imported'
  return `${picture ? 'images' : 'files'}/${group}`
}

export function fileArrived(files: Arrived[], pictureFolder?: string | null): void {
  const made = new Map<string, string | null>()
  for (const file of files) {
    const where = folderPath(file, pictureFolder).trim()
    if (!made.has(where)) made.set(where, where ? data.pages.makeFolders(where) : null)
    data.assets.move(file.meta.id, made.get(where) ?? null)
  }
}
