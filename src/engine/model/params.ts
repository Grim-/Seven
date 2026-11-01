import { InputLookupTokenPredictor } from 'node-llama-cpp'
import { THINKING_LEVELS, type ModelConfig, type ParamDef, type ParamSection, type ParamValue, type SamplingOverrides, type ThinkingLevel } from '@shared/types'

const KV_TYPES = ['F16', 'Q8_0', 'Q5_1', 'Q5_0', 'Q4_1', 'Q4_0']

type KvType = 'F16' | 'Q8_0' | 'Q5_1' | 'Q5_0' | 'Q4_1' | 'Q4_0'

const RAW: Omit<ParamDef, 'section' | 'flag'>[] = [
  { key: 'gpuLayers', label: 'GPU layers', group: 'load', target: 'load', type: 'int', default: -1, min: -1, max: 999, step: 1, hint: '-1 picks as many layers as fit in VRAM while leaving room for the context size below; the rest of the model runs from RAM. 0 keeps the model on the CPU.' },
  { key: 'contextSize', label: 'Context size', group: 'load', target: 'context', type: 'int', default: 8192, min: 0, minNonZero: 2048, max: 262144, step: 512, hint: 'Tokens of context. 0 uses the largest that fits in memory; otherwise at least 2048. Agents with tools want 8192 or more.' },
  { key: 'skipMemoryChecks', label: 'Skip memory checks', group: 'load', target: 'load', type: 'bool', default: false, hint: "Load even when node-llama-cpp estimates the model or context won't fit, e.g. when the GPU driver spills into system RAM. If memory really runs out, the engine crashes and restarts." },
  { key: 'flashAttention', label: 'Flash attention', group: 'load', target: 'context', type: 'bool', default: false, hint: 'Faster and lighter on memory where the model and GPU support it.' },
  { key: 'kvCacheKeyType', label: 'KV cache keys', group: 'load', target: 'context', type: 'select', default: 'F16', options: KV_TYPES, hint: 'How the context is stored. Q8_0 halves its memory with little loss; Q4_0 quarters it with more. Experimental.' },
  { key: 'kvCacheValueType', label: 'KV cache values', group: 'load', target: 'context', type: 'select', default: 'F16', options: KV_TYPES, hint: 'Like KV cache keys. Anything other than F16 needs flash attention on.' },
  { key: 'batchSize', label: 'Batch size', group: 'load', target: 'context', type: 'int', default: 0, min: 0, max: 8192, step: 64, hint: 'Tokens read in one step while taking in the prompt. 0 lets node-llama-cpp choose. Larger reads long prompts faster and uses more memory.' },
  { key: 'threads', label: 'CPU threads', group: 'load', target: 'context', type: 'int', default: 0, min: 0, max: 256, step: 1, hint: '0 lets node-llama-cpp choose. Matters most for layers kept on the CPU.' },
  { key: 'swaFullCache', label: 'Full sliding-window cache', group: 'load', target: 'context', type: 'bool', default: false, hint: 'For models with sliding-window attention (like Gemma): keeps the whole cache, which uses more memory but avoids re-reading the chat after edits.' },
  { key: 'promptLookup', label: 'Prompt lookup', group: 'load', target: 'context', type: 'bool', default: false, hint: "Speculative decoding without a second model: guesses the next few tokens by finding what was just written earlier in the chat, then checks the guesses in one step. Faster when replies repeat the input (editing, quoting, tool output). What gets written doesn't change. Guessed ahead in Stats shows how often the guesses are right." },
  { key: 'lookupTokens', label: 'Prompt lookup: tokens to guess', group: 'load', target: 'context', type: 'int', default: 3, min: 1, max: 16, step: 1, hint: 'Most tokens guessed at once. More helps long repeats and costs more when the guesses are wrong.' },
  { key: 'useMmap', label: 'Memory-map the file', group: 'load', target: 'load', type: 'bool', default: true, hint: 'Reads the model file on demand instead of copying it all into RAM first. Usually faster to load.' },
  { key: 'useMlock', label: 'Lock in RAM', group: 'load', target: 'load', type: 'bool', default: false, hint: 'Stops the system swapping the model out of RAM. Needs enough free RAM for the whole model.' },
  { key: 'thinking', label: 'Thinking', group: 'sampling', target: 'prompt', type: 'select', default: 'max', options: [...THINKING_LEVELS], boolMap: ['off', 'max'], hint: 'How much the model thinks before it replies. Off: not at all (Gemma 4 is not asked to; other models are cut off as soon as they start). Low, Medium and High: up to the token limits below, and for models with effort levels (gpt-oss, remote OpenAI) that effort. Max: no limit. Only matters for models that think.' },
  { key: 'thinkingLow', label: 'Low: most thinking tokens', group: 'sampling', target: 'prompt', type: 'int', default: 1024, min: 0, max: 131072, step: 256, hint: 'How long the model may think at Low, in tokens. 0 means no limit. Remote Anthropic models use it as their thinking budget (at least 1024).' },
  { key: 'thinkingMedium', label: 'Medium: most thinking tokens', group: 'sampling', target: 'prompt', type: 'int', default: 4096, min: 0, max: 131072, step: 256, hint: 'How long the model may think at Medium, in tokens. 0 means no limit.' },
  { key: 'thinkingHigh', label: 'High: most thinking tokens', group: 'sampling', target: 'prompt', type: 'int', default: 16384, min: 0, max: 131072, step: 256, hint: 'How long the model may think at High, in tokens. 0 means no limit.' },
  { key: 'temperature', label: 'Temperature', group: 'sampling', target: 'prompt', type: 'float', default: 0.7, min: 0, max: 2, step: 0.05 },
  { key: 'topP', label: 'Top P', group: 'sampling', target: 'prompt', type: 'float', default: 0.9, min: 0, max: 1, step: 0.01 },
  { key: 'topK', label: 'Top K', group: 'sampling', target: 'prompt', type: 'int', default: 40, min: 0, max: 200, step: 1 },
  { key: 'minP', label: 'Min P', group: 'sampling', target: 'prompt', type: 'float', default: 0.05, min: 0, max: 1, step: 0.01 },
  { key: 'repeatPenalty', label: 'Repeat penalty', group: 'sampling', target: 'prompt', type: 'float', default: 1.1, min: 1, max: 2, step: 0.01, hint: '1 turns it off.' },
  { key: 'frequencyPenalty', label: 'Frequency penalty', group: 'sampling', target: 'prompt', type: 'float', default: 0, min: 0, max: 2, step: 0.01, hint: 'Lowers a token more the more often it has appeared. 0 turns it off.' },
  { key: 'presencePenalty', label: 'Presence penalty', group: 'sampling', target: 'prompt', type: 'float', default: 0, min: 0, max: 2, step: 0.01, hint: 'Lowers any token that has appeared at all. 0 turns it off.' },
  { key: 'penaltyTokens', label: 'Penalty window', group: 'sampling', target: 'prompt', type: 'int', default: 64, min: 1, max: 4096, step: 16, hint: 'How many recent tokens the repeat, frequency and presence penalties look at.' },
  { key: 'dryStrength', label: 'DRY strength', group: 'sampling', target: 'prompt', type: 'float', default: 0, min: 0, max: 5, step: 0.05, hint: "Don't Repeat Yourself: stops the model repeating whole phrases. 0 turns it off; 0.8 is a common start." },
  { key: 'dryBase', label: 'DRY base', group: 'sampling', target: 'prompt', type: 'float', default: 1.75, min: 1, max: 4, step: 0.05, hint: 'How fast the DRY penalty grows with the length of a repeat.' },
  { key: 'dryAllowedLength', label: 'DRY allowed length', group: 'sampling', target: 'prompt', type: 'int', default: 2, min: 1, max: 20, step: 1, hint: 'Repeats up to this many tokens long are not penalised.' },
  { key: 'xtcProbability', label: 'XTC probability', group: 'sampling', target: 'prompt', type: 'float', default: 0, min: 0, max: 1, step: 0.01, hint: 'Exclude Top Choices: the chance each step of dropping the most likely tokens, for more varied writing. 0 turns it off; 0.5 is a common start.' },
  { key: 'xtcThreshold', label: 'XTC threshold', group: 'sampling', target: 'prompt', type: 'float', default: 0.1, min: 0, max: 1, step: 0.01, hint: 'Tokens at least this likely can be dropped by XTC.' },
  { key: 'seed', label: 'Seed', group: 'sampling', target: 'prompt', type: 'int', default: -1, min: -1, max: 2147483647, step: 1, hint: '-1 picks a new one each time. A fixed number gives the same reply to the same chat.' },
  { key: 'maxTokens', label: 'Max reply tokens', group: 'sampling', target: 'prompt', type: 'int', default: 0, min: 0, max: 32768, step: 64, hint: '0 means no limit beyond the context.' }
]

const SECTION: Record<string, ParamSection> = {
  gpuLayers: 'memory',
  skipMemoryChecks: 'memory',
  useMmap: 'memory',
  useMlock: 'memory',
  contextSize: 'context',
  flashAttention: 'context',
  kvCacheKeyType: 'context',
  kvCacheValueType: 'context',
  batchSize: 'context',
  threads: 'context',
  swaFullCache: 'context',
  promptLookup: 'speed',
  lookupTokens: 'speed',
  thinking: 'thinking',
  thinkingLow: 'thinking',
  thinkingMedium: 'thinking',
  thinkingHigh: 'thinking',
  temperature: 'sampling',
  topP: 'sampling',
  topK: 'sampling',
  minP: 'sampling',
  seed: 'sampling',
  maxTokens: 'sampling',
  repeatPenalty: 'repetition',
  frequencyPenalty: 'repetition',
  presencePenalty: 'repetition',
  penaltyTokens: 'repetition',
  dryStrength: 'repetition',
  dryBase: 'repetition',
  dryAllowedLength: 'repetition',
  xtcProbability: 'advanced',
  xtcThreshold: 'advanced'
}

const FLAGS: Record<string, string[]> = {
  gpuLayers: ['-ngl', '--gpu-layers', '--n-gpu-layers'],
  contextSize: ['-c', '--ctx-size'],
  flashAttention: ['-fa', '--flash-attn'],
  kvCacheKeyType: ['-ctk', '--cache-type-k'],
  kvCacheValueType: ['-ctv', '--cache-type-v'],
  batchSize: ['-b', '--batch-size'],
  threads: ['-t', '--threads'],
  swaFullCache: ['--swa-full'],
  useMmap: ['--mmap'],
  useMlock: ['--mlock'],
  temperature: ['--temp', '--temperature'],
  topP: ['--top-p'],
  topK: ['--top-k'],
  minP: ['--min-p'],
  seed: ['-s', '--seed'],
  maxTokens: ['-n', '--n-predict', '--predict'],
  repeatPenalty: ['--repeat-penalty'],
  frequencyPenalty: ['--frequency-penalty'],
  presencePenalty: ['--presence-penalty'],
  penaltyTokens: ['--repeat-last-n'],
  dryStrength: ['--dry-multiplier'],
  dryBase: ['--dry-base'],
  dryAllowedLength: ['--dry-allowed-length'],
  xtcProbability: ['--xtc-probability'],
  xtcThreshold: ['--xtc-threshold']
}

export const PARAMS: ParamDef[] = RAW.map((p) => ({ ...p, section: SECTION[p.key] ?? 'advanced', ...(FLAGS[p.key] ? { flag: FLAGS[p.key] } : {}) }))

const byKey = new Map(PARAMS.map((p) => [p.key, p]))

export function defaults(): ModelConfig {
  const out: ModelConfig = {}
  for (const p of PARAMS) out[p.key] = p.default
  return out
}

function coerce(def: ParamDef, value: unknown): ParamValue {
  if (def.boolMap && typeof value === 'boolean') return value ? def.boolMap[1] : def.boolMap[0]
  if (def.type === 'bool') return value === true || value === 'true'
  if (def.type === 'select') return typeof value === 'string' && def.options?.includes(value) ? value : def.default
  let n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return def.default
  if (def.type === 'int') n = Math.round(n)
  if (def.min !== undefined) n = Math.max(def.min, n)
  if (def.minNonZero !== undefined && n !== 0) n = Math.max(def.minNonZero, n)
  if (def.max !== undefined) n = Math.min(def.max, n)
  return n
}

export function normalize(partial: Record<string, unknown>): ModelConfig {
  const out = defaults()
  for (const [key, value] of Object.entries(partial)) {
    const def = byKey.get(key)
    if (def) out[key] = coerce(def, value)
  }
  return out
}

export function reloadRequired(prev: ModelConfig, next: ModelConfig): boolean {
  return PARAMS.some((p) => p.group === 'load' && prev[p.key] !== next[p.key])
}

export function loadOptions(config: ModelConfig): {
  gpuLayers?: number | { fitContext: { contextSize: number } }
  ignoreMemorySafetyChecks: boolean
  defaultContextFlashAttention: boolean
  useMmap: boolean
  useMlock: boolean
} {
  const gpuLayers = config.gpuLayers as number
  const contextSize = config.contextSize as number
  const base = { ignoreMemorySafetyChecks: config.skipMemoryChecks as boolean, defaultContextFlashAttention: config.flashAttention as boolean, useMmap: config.useMmap !== false, useMlock: config.useMlock === true }
  if (gpuLayers >= 0) return { gpuLayers, ...base }
  if (contextSize > 0) return { gpuLayers: { fitContext: { contextSize } }, ...base }
  return base
}

export function contextOptions(config: ModelConfig): {
  contextSize?: number
  batchSize?: number
  threads?: number
  flashAttention: boolean
  ignoreMemorySafetyChecks: boolean
  swaFullCache: boolean
  experimentalKvCacheKeyType?: KvType
  experimentalKvCacheValueType?: KvType
} {
  const contextSize = config.contextSize as number
  const batchSize = config.batchSize as number
  const threads = config.threads as number
  const keys = String(config.kvCacheKeyType ?? 'F16') as KvType
  const values = String(config.kvCacheValueType ?? 'F16') as KvType
  return {
    ...(contextSize > 0 ? { contextSize } : {}),
    ...(batchSize > 0 ? { batchSize } : {}),
    ...(threads > 0 ? { threads } : {}),
    flashAttention: config.flashAttention as boolean,
    ignoreMemorySafetyChecks: config.skipMemoryChecks as boolean,
    swaFullCache: config.swaFullCache === true,
    ...(keys !== 'F16' ? { experimentalKvCacheKeyType: keys } : {}),
    ...(values !== 'F16' ? { experimentalKvCacheValueType: values } : {})
  }
}

export interface PromptSampling {
  temperature: number
  topP: number
  topK: number
  minP: number
  repeatPenalty: false | { penalty: number; frequencyPenalty: number; presencePenalty: number; lastTokens: number }
  dryRepeatPenalty?: { strength: number; base: number; allowedLength: number }
  xtc?: { probability: number; threshold: number }
  seed?: number
  maxTokens?: number
  budgets?: { thoughtTokens: number }
  effort?: 'low' | 'medium' | 'high'
}

function merge(config: ModelConfig, overrides: SamplingOverrides): ModelConfig {
  const merged = { ...config }
  for (const [key, value] of Object.entries(overrides)) {
    const def = byKey.get(key)
    if (def && value !== undefined && value !== null) merged[key] = coerce(def, value)
  }
  return merged
}

export function thinkingLevel(config: ModelConfig): ThinkingLevel {
  const level = String(config.thinking) as ThinkingLevel
  return THINKING_LEVELS.includes(level) ? level : 'max'
}

export function withThinking(config: ModelConfig, level: ThinkingLevel | null | undefined): ModelConfig {
  return level ? { ...config, thinking: level } : config
}

const BUDGET: Record<'low' | 'medium' | 'high', string> = { low: 'thinkingLow', medium: 'thinkingMedium', high: 'thinkingHigh' }

function thinkingOptions(config: ModelConfig, templateHandlesThinking: boolean): Pick<PromptSampling, 'budgets' | 'effort'> {
  const level = thinkingLevel(config)
  if (level === 'off') return templateHandlesThinking ? {} : { budgets: { thoughtTokens: 0 } }
  if (level === 'max') return {}
  const cap = Number(config[BUDGET[level]]) || 0
  return { effort: level, ...(cap > 0 ? { budgets: { thoughtTokens: cap } } : {}) }
}

export function promptOptions(config: ModelConfig, overrides: SamplingOverrides, templateHandlesThinking = false): PromptSampling {
  const merged = merge(config, overrides)
  const penalty = merged.repeatPenalty as number
  const frequencyPenalty = merged.frequencyPenalty as number
  const presencePenalty = merged.presencePenalty as number
  const maxTokens = merged.maxTokens as number
  const dry = merged.dryStrength as number
  const xtc = merged.xtcProbability as number
  const seed = merged.seed as number
  return {
    temperature: merged.temperature as number,
    topP: merged.topP as number,
    topK: merged.topK as number,
    minP: merged.minP as number,
    repeatPenalty: penalty > 1 || frequencyPenalty > 0 || presencePenalty > 0 ? { penalty, frequencyPenalty, presencePenalty, lastTokens: merged.penaltyTokens as number } : false,
    ...(dry > 0 ? { dryRepeatPenalty: { strength: dry, base: merged.dryBase as number, allowedLength: merged.dryAllowedLength as number } } : {}),
    ...(xtc > 0 ? { xtc: { probability: xtc, threshold: merged.xtcThreshold as number } } : {}),
    ...(seed >= 0 ? { seed } : {}),
    ...(maxTokens > 0 ? { maxTokens } : {}),
    ...thinkingOptions(merged, templateHandlesThinking)
  }
}

export function sequenceOptions(config: ModelConfig): { tokenPredictor?: InputLookupTokenPredictor } {
  return config.promptLookup === true ? { tokenPredictor: new InputLookupTokenPredictor({ predictionLength: { max: config.lookupTokens as number } }) } : {}
}
