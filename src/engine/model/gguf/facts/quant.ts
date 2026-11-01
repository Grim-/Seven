import { GgufFileType } from 'node-llama-cpp'
import { count, type GgufView } from '../view'

const PREFIXES = ['MOSTLY_', 'ALL_']

export function resolveQuant(v: GgufView): string | null {
  const type = count(v.general.file_type)
  if (type === null) return null
  const name = GgufFileType[type]
  if (!name) return null
  const prefix = PREFIXES.find((p) => name.startsWith(p))
  return prefix ? name.slice(prefix.length) : name
}
