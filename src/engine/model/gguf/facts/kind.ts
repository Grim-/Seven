import type { ModelKind } from '@shared/types'
import { text, type GgufView } from '../view'

const BY_TYPE: Record<string, ModelKind> = { imatrix: 'imatrix', mmproj: 'projector' }

export function resolveKind(v: GgufView): ModelKind {
  const declared = text(v.general.type)
  if (declared && BY_TYPE[declared]) return BY_TYPE[declared]
  if (v.arch.pooling_type !== undefined) return 'embedding'
  return v.architecture ? 'chat' : 'other'
}
