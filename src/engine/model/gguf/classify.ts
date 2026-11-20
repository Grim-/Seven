import type { ModelInfo } from '@shared/types'
import { count, text, type GgufView } from './view'
import { resolveKind } from './facts/kind'
import { resolveQuant } from './facts/quant'
import { resolveExperts } from './facts/experts'
import { resolveMtpLayers } from './facts/mtp'
import { resolveImatrix } from './facts/imatrix'
import { resolveChatTemplate } from './facts/chatTemplate'
import { resolveSplit } from './facts/split'

type HeaderFacts = Omit<ModelInfo, 'sizeBytes'>

const RESOLVERS: { [K in keyof HeaderFacts]: (v: GgufView) => HeaderFacts[K] } = {
  kind: resolveKind,
  architecture: (v) => {
    if (v.architecture) return v.architecture
    if (v.tensorNames.some((n) => n.startsWith('double_blocks.') || n.startsWith('single_blocks.'))) return 'flux'
    if (v.tensorNames.some((n) => n.startsWith('joint_blocks.'))) return 'sd3'
    if (v.tensorNames.some((n) => n.startsWith('model.diffusion_model.') || n.startsWith('diffusion_model.'))) return 'stable-diffusion'
    return null
  },
  name: (v) => text(v.general.name),
  sizeLabel: (v) => text(v.general.size_label),
  author: (v) => text(v.general.organization) ?? text(v.general.author),
  license: (v) => text(v.general.license),
  contextLength: (v) => count(v.arch.context_length),
  layers: (v) => count(v.arch.block_count),
  embeddingLength: (v) => count(v.arch.embedding_length),
  chatTemplate: resolveChatTemplate,
  quant: resolveQuant,
  experts: resolveExperts,
  mtpLayers: resolveMtpLayers,
  slidingWindow: (v) => {
    const attention = v.arch.attention
    return attention && typeof attention === 'object' ? count((attention as Record<string, unknown>).sliding_window) : null
  },
  imatrix: resolveImatrix,
  split: resolveSplit
}

export function classify(view: GgufView, sizeBytes: number | null): ModelInfo {
  const facts = Object.fromEntries(Object.entries(RESOLVERS).map(([key, resolve]) => [key, (resolve as (v: GgufView) => unknown)(view)])) as HeaderFacts
  return { ...facts, sizeBytes }
}
