import { GgufInsights, readGgufFileInfo, type GgufFileInfo } from 'node-llama-cpp'
import type { ModelInfo } from '@shared/types'
import { classify } from './classify'
import { resolveSplit } from './facts/split'
import { viewOf } from './view'

const SKIPPED = ['tokenizer.ggml.tokens', 'tokenizer.ggml.token_type', 'tokenizer.ggml.scores', 'tokenizer.ggml.merges']

export interface HeaderRead {
  tokens?: { huggingFace?: string }
  size: boolean
}

export function readMeta(source: string): Promise<GgufFileInfo> {
  return readGgufFileInfo(source, { ignoreKeys: SKIPPED, logWarnings: false, readTensorInfo: false, spliceSplitFiles: false })
}

export async function readHeader(source: string, how: HeaderRead): Promise<ModelInfo> {
  const base = { ignoreKeys: SKIPPED, logWarnings: false, ...(how.tokens ? { tokens: how.tokens } : {}) }
  const own = await readGgufFileInfo(source, { ...base, readTensorInfo: how.size, spliceSplitFiles: false })
  const split = resolveSplit(viewOf(own))
  if (!how.size || (split && split.part > 0)) return classify(own, null)
  const whole = split ? await readGgufFileInfo(source, { ...base, readTensorInfo: true, spliceSplitFiles: true }) : own
  return classify(own, (await GgufInsights.from(whole)).modelSize)
}
