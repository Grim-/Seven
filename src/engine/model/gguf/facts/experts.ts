import { count, type GgufView } from '../view'

export function resolveExperts(v: GgufView): { count: number; used: number | null } | null {
  const total = count(v.arch.expert_count)
  return total && total > 1 ? { count: total, used: count(v.arch.expert_used_count) } : null
}
