import { count, type GgufView } from '../view'

export function resolveSplit(v: GgufView): { part: number; parts: number } | null {
  const parts = count(v.split.count)
  const part = count(v.split.no)
  return parts !== null && parts > 1 && part !== null ? { part, parts } : null
}
