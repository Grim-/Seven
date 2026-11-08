import type { AssetMeta } from '@shared/types'
import { ToolError } from '../tools/types'
import { data } from '../data/hub'
import { USER, resolveEntry } from './kinds'


export function resolveFile(ref: string, kinds: AssetMeta['kind'][] | null, what: string): AssetMeta {
  const r = ref.trim()
  let found: AssetMeta | null | undefined = data.assets.exists(r) ? data.assets.get(r) : undefined
  if (!found) {
    try {
      const hit = resolveEntry(r, 'file', USER)
      found = hit.kind.asset?.(hit.id) ?? null
    } catch {
      found = data.assets.findByName(r)
    }
  }
  if (!found) throw new ToolError(`There is no file "${r}" in the library. find with kind file lists them.`)
  if (kinds && !kinds.includes(found.kind)) throw new ToolError(`"${found.name}" is not ${what}. Give ${what} instead; find with kind file lists the files.`)
  return found
}
