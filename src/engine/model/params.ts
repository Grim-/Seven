import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { THINKING_LEVELS, type ModelConfig, type ModelTraitSet, type ParamDef, type ParamValue, type SamplingOverrides, type ThinkingLevel } from '@shared/types'
import { fileList, fileListFlag, paramBlock } from '@shared/modelParams'

const KV_TYPES = ['F16', 'F32', 'BF16', 'Q8_0', 'Q5_1', 'Q5_0', 'Q4_1', 'Q4_0', 'IQ4_NL']
const NGRAM_TYPES = ['none', 'ngram-simple', 'ngram-map-k', 'ngram-map-k4v', 'ngram-mod', 'ngram-cache']
const DRAFT_TYPES = ['none', 'draft-simple', 'draft-eagle3', 'draft-dflash', 'draft-dspark']
const GGUF = { name: 'GGUF', extensions: ['gguf'] }

const MOE = { trait: 'moe', reason: 'This model has no experts (it is not MoE).' } as const
const DENSE = { trait: 'dense', reason: 'This model is MoE; use Expert layers on CPU instead.' } as const
const MTP = { trait: 'mtp', reason: 'This model has no MTP heads.' } as const
const SWA = { trait: 'swa', reason: 'This model has no sliding-window attention.' } as const
const VISION = { trait: 'vision', reason: 'No vision adapter is set for this model.' } as const

const DRAFTING = { any: [{ key: 'mtp', values: [true] }, { key: 'draftType', values: DRAFT_TYPES.slice(1) }], reason: 'Only with MTP on or a draft model type set.' }
const ngram = (type: string) => ({ any: [{ key: 'ngram', values: [type] }], reason: `Only with Ngram speed-up set to ${type}.` })

export const PARAMS: ParamDef[] = [
  { key: 'gpuLayers', label: 'GPU layers', group: 'load', section: 'memory', target: 'load', type: 'int', default: -1, min: -1, max: 999, step: 1, flag: ['-ngl', '--gpu-layers', '--n-gpu-layers'], emit: 'value', skip: [-1], hint: "-1 lets llama-server fit as many layers as it can in VRAM; the rest of the model runs from RAM. 0 keeps the model on the CPU." },
  { key: 'fit', label: 'Fit to memory', group: 'load', section: 'memory', target: 'load', type: 'select', default: 'on', options: ['on', 'off'], flag: ['-fit', '--fit'], emit: 'value', hint: 'On: llama-server changes the settings you left unset (GPU layers, context) so the model fits in device memory.' },
  { key: 'fitTarget', label: 'Fit: free memory to leave (MiB)', group: 'load', section: 'memory', target: 'load', type: 'text', default: '', flag: ['-fitt', '--fit-target'], emit: 'value', when: { any: [{ key: 'fit', values: ['on'] }], reason: 'Only with Fit to memory on.' }, hint: 'MiB to keep free on each device, comma-separated per device (one value is used for all). Empty uses 1024.' },
  { key: 'fitCtx', label: 'Fit: smallest context', group: 'load', section: 'memory', target: 'load', type: 'int', default: 4096, min: 0, max: 262144, step: 512, flag: ['-fitc', '--fit-ctx'], emit: 'value', when: { any: [{ key: 'fit', values: ['on'] }], reason: 'Only with Fit to memory on.' }, hint: 'Fit never lowers the context below this.' },
  { key: 'loadMode', label: 'Load mode', group: 'load', section: 'memory', target: 'load', type: 'select', default: 'auto', options: ['auto', 'mmap', 'mlock', 'mmap+mlock', 'none', 'dio'], flag: ['-lm', '--load-mode'], emit: 'value', hint: 'auto: memory-map the file unless a device can\'t. mmap: read the file on demand. mlock: keep the whole model in RAM so it is never swapped out. mmap+mlock: both. none: plain loading. dio: DirectIO where available.' },
  { key: 'lazyMode', label: 'Lazy tensors', group: 'load', section: 'memory', target: 'load', type: 'select', default: 'auto', options: ['auto', 'on', 'off'], flag: ['-lzm', '--lazy-mode'], emit: 'value', hint: 'Reads rows of some big tensors (like per-layer embeddings) from disk when needed instead of keeping them in memory. auto: only for tensors over 4 GiB. Needs memory-mapping.' },
  { key: 'kvOffload', label: 'Context on GPU', group: 'load', section: 'memory', target: 'load', type: 'bool', default: true, flag: ['-kvo', '--kv-offload'], emit: 'off', hint: 'Off keeps the context (KV cache) in RAM, freeing VRAM for layers. Slower.' },
  { key: 'cpuMoeLayers', label: 'Expert layers on CPU', group: 'load', section: 'memory', target: 'load', type: 'int', default: 0, min: 0, max: 999, step: 1, flag: ['-ncmoe', '--n-cpu-moe'], emit: 'value', needs: MOE, when: { any: [{ key: 'cpuMoeAll', values: [false] }], reason: 'All experts on CPU is on.' }, hint: 'Keeps the experts of this many layers in RAM, freeing VRAM for the rest of the model and the context. 0 keeps none on the CPU on purpose.' },
  { key: 'cpuMoeAll', label: 'All experts on CPU', group: 'load', section: 'memory', target: 'load', type: 'bool', default: false, flag: ['-cmoe', '--cpu-moe'], emit: 'on', needs: MOE, hint: 'Every expert stays in RAM; the rest of the model goes on the GPU.' },
  { key: 'moeCache', label: 'Expert cache on GPU (MiB)', group: 'load', section: 'memory', target: 'load', type: 'int', default: 0, min: 0, max: 262144, step: 256, flag: ['--moe-cache-mib'], emit: 'value', needs: MOE, hint: 'VRAM to cache the experts kept on the CPU, so the ones used most run on the GPU. Split across GPUs like the layers. 0 turns it off.' },
  { key: 'cpuFfnLayers', label: 'FFN layers on CPU', group: 'load', section: 'memory', target: 'load', type: 'int', default: 0, min: 0, max: 999, step: 1, flag: ['-ncffn', '--n-cpu-ffn'], emit: 'value', needs: DENSE, hint: 'Dense models: keeps the feed-forward weights of the first this many layers in RAM, freeing VRAM. 0 keeps none on the CPU.' },
  { key: 'tensorOverride', label: 'Tensor placement', group: 'load', section: 'memory', target: 'load', type: 'text', default: '', flag: ['-ot', '--override-tensor'], emit: 'value', hint: 'Pattern=device pairs saying where tensors go, e.g. "blk\\.(2[0-9])\\.ffn_.*_exps=CPU". Comma-separate several. Empty leaves it to llama-server.' },
  { key: 'device', label: 'Devices', group: 'load', section: 'memory', target: 'load', type: 'text', default: '', flag: ['-dev', '--device'], emit: 'value', hint: 'Comma-separated devices to offload to, e.g. CUDA0,CUDA1, or none for CPU only. Empty uses every device llama-server finds.' },
  { key: 'splitMode', label: 'Multi-GPU split', group: 'load', section: 'memory', target: 'load', type: 'select', default: 'layer', options: ['layer', 'row', 'tensor', 'none'], flag: ['-sm', '--split-mode'], emit: 'value', hint: 'With more than one GPU. layer: layers and context split across GPUs. row: each weight split by rows. tensor: weights and context split (experimental). none: one GPU only.' },
  { key: 'tensorSplit', label: 'GPU split proportions', group: 'load', section: 'memory', target: 'load', type: 'text', default: '', flag: ['-ts', '--tensor-split'], emit: 'value', hint: 'How much of the model goes on each GPU, e.g. 3,1. Empty splits by free memory.' },
  { key: 'mainGpu', label: 'Main GPU', group: 'load', section: 'memory', target: 'load', type: 'int', default: 0, min: 0, max: 16, step: 1, flag: ['-mg', '--main-gpu'], emit: 'value', hint: 'The GPU used with Multi-GPU split none, or for intermediate results and the context with row.' },
  { key: 'repack', label: 'Repack weights', group: 'load', section: 'memory', target: 'load', type: 'bool', default: true, flag: ['--repack'], emit: 'off', hint: 'Rearranges CPU weights for faster maths. Off loads a little faster.' },
  { key: 'noHost', label: 'Bypass host buffer', group: 'load', section: 'memory', target: 'load', type: 'bool', default: false, flag: ['--no-host'], emit: 'on', hint: 'Lets extra buffer types be used. Advanced.' },
  { key: 'numa', label: 'NUMA', group: 'load', section: 'memory', target: 'load', type: 'select', default: 'off', options: ['off', 'distribute', 'isolate', 'numactl'], flag: ['--numa'], emit: 'value', skip: ['off'], hint: 'For machines with more than one CPU socket. distribute spreads work over all nodes; isolate stays on the starting node.' },
  { key: 'contextSize', label: 'Context size', group: 'load', section: 'context', target: 'context', type: 'int', default: 8192, min: 0, minNonZero: 2048, max: 262144, step: 512, flag: ['-c', '--ctx-size'], emit: 'value', skip: [0], hint: "Tokens of context. 0 uses the model's own trained size, which Fit to memory may lower to fit; otherwise at least 2048. Agents with tools want 8192 or more." },
  { key: 'flashAttention', label: 'Flash attention', group: 'load', section: 'context', target: 'context', type: 'select', default: 'auto', options: ['auto', 'on', 'off'], boolMap: ['off', 'on'], flag: ['-fa', '--flash-attn'], emit: 'value', hint: 'Faster and lighter on memory where the model and GPU support it. auto lets llama-server decide.' },
  { key: 'kvCacheKeyType', label: 'KV cache keys', group: 'load', section: 'context', target: 'context', type: 'select', default: 'F16', options: KV_TYPES, flag: ['-ctk', '--cache-type-k'], emit: 'value', hint: 'How the context is stored. Q8_0 halves its memory with little loss; Q4_0 quarters it with more.' },
  { key: 'kvCacheValueType', label: 'KV cache values', group: 'load', section: 'context', target: 'context', type: 'select', default: 'F16', options: KV_TYPES, flag: ['-ctv', '--cache-type-v'], emit: 'value', hint: 'Like KV cache keys. Anything other than F16 needs flash attention.' },
  { key: 'batchSize', label: 'Batch size', group: 'load', section: 'context', target: 'context', type: 'int', default: 0, min: 0, max: 8192, step: 64, flag: ['-b', '--batch-size'], emit: 'value', skip: [0], hint: 'Tokens read in one step while taking in the prompt. 0 uses 2048. Larger reads long prompts faster and uses more memory.' },
  { key: 'ubatchSize', label: 'Micro-batch size', group: 'load', section: 'context', target: 'context', type: 'int', default: 0, min: 0, max: 8192, step: 64, flag: ['-ub', '--ubatch-size'], emit: 'value', skip: [0], hint: 'Tokens processed in one go while reading the prompt. 0 uses 512. Larger reads faster and uses more VRAM.' },
  { key: 'keep', label: 'Tokens kept on shift', group: 'load', section: 'context', target: 'context', type: 'int', default: 0, min: -1, max: 262144, step: 64, flag: ['--keep'], emit: 'value', hint: 'When the context fills and shifts, this many tokens from the start are kept. -1 keeps the whole first prompt.' },
  { key: 'swaFullCache', label: 'Full sliding-window cache', group: 'load', section: 'context', target: 'context', type: 'bool', default: false, flag: ['--swa-full'], emit: 'on', needs: SWA, hint: 'Keeps the whole cache, which uses more memory but avoids re-reading the chat after edits.' },
  { key: 'cachePrompt', label: 'Prompt cache', group: 'load', section: 'context', target: 'context', type: 'bool', default: true, flag: ['--cache-prompt'], emit: 'off', hint: 'Reuses the part of the chat already read instead of reading it all again each message.' },
  { key: 'cacheReuse', label: 'Prompt cache reuse', group: 'load', section: 'context', target: 'context', type: 'int', default: 0, min: 0, max: 4096, step: 16, flag: ['--cache-reuse'], emit: 'value', when: { any: [{ key: 'cachePrompt', values: [true] }], reason: 'Only with Prompt cache on.' }, hint: 'After an edit or trim, reuses matching chunks of at least this many tokens from the cache instead of reading them again. 0 turns it off.' },
  { key: 'cacheRam', label: 'Prompt cache in RAM (MiB)', group: 'load', section: 'context', target: 'context', type: 'int', default: 8192, min: -1, max: 1048576, step: 512, flag: ['-cram', '--cache-ram'], emit: 'value', hint: 'Most RAM used to keep earlier prompts for reuse. -1 no limit, 0 off.' },
  { key: 'ctxCheckpoints', label: 'Context checkpoints', group: 'load', section: 'context', target: 'context', type: 'int', default: 32, min: 0, max: 1024, step: 1, flag: ['-ctxcp', '--ctx-checkpoints', '--swa-checkpoints'], emit: 'value', hint: 'Most saved points per chat that llama-server can go back to without re-reading, for models that cannot simply trim their cache.' },
  { key: 'checkpointStep', label: 'Checkpoint spacing', group: 'load', section: 'context', target: 'context', type: 'int', default: 8192, min: 0, max: 262144, step: 256, flag: ['-cms', '--checkpoint-min-step'], emit: 'value', hint: 'Fewest tokens between checkpoints. 0 means no minimum.' },
  { key: 'ropeScaling', label: 'RoPE scaling', group: 'load', section: 'context', target: 'context', type: 'select', default: 'model', options: ['model', 'none', 'linear', 'yarn'], flag: ['--rope-scaling'], emit: 'value', skip: ['model'], hint: "How the context is stretched past the trained size. model uses what the file says." },
  { key: 'ropeScale', label: 'RoPE scale', group: 'load', section: 'context', target: 'context', type: 'float', default: 0, min: 0, max: 64, step: 0.25, flag: ['--rope-scale'], emit: 'value', skip: [0], hint: 'Stretches the context by this factor. 0 uses the model value.' },
  { key: 'ropeFreqBase', label: 'RoPE base frequency', group: 'load', section: 'context', target: 'context', type: 'float', default: 0, min: 0, max: 100000000, step: 1000, flag: ['--rope-freq-base'], emit: 'value', skip: [0], hint: '0 uses the model value.' },
  { key: 'ropeFreqScale', label: 'RoPE frequency scale', group: 'load', section: 'context', target: 'context', type: 'float', default: 0, min: 0, max: 1, step: 0.01, flag: ['--rope-freq-scale'], emit: 'value', skip: [0], hint: 'Stretches the context by 1/N. 0 uses the model value.' },
  { key: 'yarnOrigCtx', label: 'YaRN: trained context', group: 'load', section: 'context', target: 'context', type: 'int', default: 0, min: 0, max: 1048576, step: 1024, flag: ['--yarn-orig-ctx'], emit: 'value', skip: [0], when: { any: [{ key: 'ropeScaling', values: ['yarn'] }], reason: 'Only with RoPE scaling yarn.' }, hint: '0 uses the trained context from the file.' },
  { key: 'yarnExtFactor', label: 'YaRN: extrapolation mix', group: 'load', section: 'context', target: 'context', type: 'float', default: -1, min: -1, max: 1, step: 0.05, flag: ['--yarn-ext-factor'], emit: 'value', when: { any: [{ key: 'ropeScaling', values: ['yarn'] }], reason: 'Only with RoPE scaling yarn.' }, hint: '-1 uses the model value; 0 is full interpolation.' },
  { key: 'yarnAttnFactor', label: 'YaRN: attention scale', group: 'load', section: 'context', target: 'context', type: 'float', default: -1, min: -1, max: 10, step: 0.05, flag: ['--yarn-attn-factor'], emit: 'value', when: { any: [{ key: 'ropeScaling', values: ['yarn'] }], reason: 'Only with RoPE scaling yarn.' }, hint: '-1 uses the model value.' },
  { key: 'yarnBetaSlow', label: 'YaRN: beta slow', group: 'load', section: 'context', target: 'context', type: 'float', default: -1, min: -1, max: 100, step: 0.5, flag: ['--yarn-beta-slow'], emit: 'value', when: { any: [{ key: 'ropeScaling', values: ['yarn'] }], reason: 'Only with RoPE scaling yarn.' }, hint: 'High correction dimension. -1 uses the model value.' },
  { key: 'yarnBetaFast', label: 'YaRN: beta fast', group: 'load', section: 'context', target: 'context', type: 'float', default: -1, min: -1, max: 100, step: 0.5, flag: ['--yarn-beta-fast'], emit: 'value', when: { any: [{ key: 'ropeScaling', values: ['yarn'] }], reason: 'Only with RoPE scaling yarn.' }, hint: 'Low correction dimension. -1 uses the model value.' },
  { key: 'serverTimeout', label: 'Server timeout (seconds)', group: 'load', section: 'context', target: 'load', type: 'int', default: 3600, min: 1, max: 604800, step: 60, flag: ['-to', '--timeout'], emit: 'value', hint: 'llama-server drops a request that reads or writes nothing for this long. A reply that takes longer is cut off.' },
  { key: 'threads', label: 'CPU threads', group: 'load', section: 'speed', target: 'context', type: 'int', default: 0, min: 0, max: 256, step: 1, flag: ['-t', '--threads'], emit: 'value', skip: [0], hint: '0 lets llama-server choose. Matters most for layers kept on the CPU.' },
  { key: 'threadsBatch', label: 'CPU threads for prompts', group: 'load', section: 'speed', target: 'context', type: 'int', default: 0, min: 0, max: 256, step: 1, flag: ['-tb', '--threads-batch'], emit: 'value', skip: [0], hint: 'Threads used while reading the prompt. 0 uses CPU threads.' },
  { key: 'priority', label: 'Process priority', group: 'load', section: 'speed', target: 'load', type: 'int', default: 0, min: -1, max: 3, step: 1, flag: ['--prio'], emit: 'value', hint: '-1 low, 0 normal, 1 medium, 2 high, 3 realtime.' },
  { key: 'poll', label: 'Polling', group: 'load', section: 'speed', target: 'load', type: 'int', default: 50, min: 0, max: 100, step: 5, flag: ['--poll'], emit: 'value', hint: 'How hard idle threads spin waiting for work. 0 sleeps; higher reacts faster and uses more CPU.' },
  { key: 'mtp', label: 'Multi-token prediction (MTP)', group: 'load', section: 'speed', target: 'load', type: 'bool', default: true, needs: MTP, hint: "The model drafts several tokens at once and checks them in one step, which is faster. What gets written doesn't change." },
  { key: 'draftModel', label: 'Draft model file', group: 'load', section: 'files', target: 'load', type: 'file', default: '', files: GGUF, flag: ['-md', '--model-draft', '--spec-draft-model'], hint: 'A small model from the same family that guesses ahead for this one. Used with Draft model type.' },
  { key: 'draftType', label: 'Draft model type', group: 'load', section: 'speed', target: 'load', type: 'select', default: 'none', options: DRAFT_TYPES, when: { any: [{ key: 'draftModel' }], reason: 'Pick a draft model file first.' }, hint: 'How the draft model is used. draft-simple is a normal small model; eagle3, dflash and dspark need draft files made for them.' },
  { key: 'ngram', label: 'Ngram speed-up', group: 'load', section: 'speed', target: 'load', type: 'select', default: 'none', options: NGRAM_TYPES, hint: 'Guesses ahead by matching text already in the chat, no extra file. Helps most when replies repeat earlier text (code edits, quoting).' },
  { key: 'mtpDraft', label: 'Draft: most tokens', group: 'load', section: 'speed', target: 'load', type: 'int', default: 3, min: 1, max: 64, step: 1, flag: ['--spec-draft-n-max'], emit: 'value', when: DRAFTING, hint: 'How many tokens MTP or the draft model guesses ahead each step. More helps when guesses are usually right and costs more when they are wrong.' },
  { key: 'draftMin', label: 'Draft: fewest tokens', group: 'load', section: 'speed', target: 'load', type: 'int', default: 0, min: 0, max: 64, step: 1, flag: ['--spec-draft-n-min'], emit: 'value', when: DRAFTING, hint: 'Smallest draft worth checking.' },
  { key: 'draftPMin', label: 'Draft: lowest probability', group: 'load', section: 'speed', target: 'load', type: 'float', default: 0, min: 0, max: 1, step: 0.01, flag: ['--spec-draft-p-min', '--draft-p-min'], emit: 'value', when: DRAFTING, hint: 'Stops a draft at a guess less likely than this.' },
  { key: 'draftPSplit', label: 'Draft: split probability', group: 'load', section: 'speed', target: 'load', type: 'float', default: 0.1, min: 0, max: 1, step: 0.01, flag: ['--spec-draft-p-split', '--draft-p-split'], emit: 'value', when: DRAFTING, hint: 'Speculative decoding split probability.' },
  { key: 'draftSampling', label: 'Draft: sampling', group: 'load', section: 'speed', target: 'load', type: 'select', default: 'greedy', options: ['greedy', 'probabilistic'], flag: ['--spec-draft-sampling'], emit: 'value', when: DRAFTING, hint: 'greedy takes the draft\'s top guess; probabilistic samples it and the model checks it by rejection sampling.' },
  { key: 'draftUbatch', label: 'Draft: micro-batch size', group: 'load', section: 'speed', target: 'load', type: 'int', default: 0, min: 0, max: 8192, step: 64, flag: ['--spec-draft-n-ubatch'], emit: 'value', when: DRAFTING, hint: 'Smaller spares VRAM. 0 uses Micro-batch size.' },
  { key: 'draftKvK', label: 'Draft: KV cache keys', group: 'load', section: 'speed', target: 'load', type: 'select', default: 'F16', options: KV_TYPES, flag: ['-ctkd', '--cache-type-k-draft', '--spec-draft-type-k'], emit: 'value', when: DRAFTING, hint: 'How the draft context is stored.' },
  { key: 'draftKvV', label: 'Draft: KV cache values', group: 'load', section: 'speed', target: 'load', type: 'select', default: 'F16', options: KV_TYPES, flag: ['-ctvd', '--cache-type-v-draft', '--spec-draft-type-v'], emit: 'value', when: DRAFTING, hint: 'Like Draft: KV cache keys.' },
  { key: 'draftGpuLayers', label: 'Draft model: GPU layers', group: 'load', section: 'speed', target: 'load', type: 'int', default: -1, min: -1, max: 999, step: 1, flag: ['-ngld', '--gpu-layers-draft', '--spec-draft-ngl'], emit: 'value', skip: [-1], when: { any: [{ key: 'draftType', values: DRAFT_TYPES.slice(1) }], reason: 'Only with a draft model type set.' }, hint: '-1 lets llama-server decide.' },
  { key: 'ngramModMin', label: 'ngram-mod: fewest tokens', group: 'load', section: 'speed', target: 'load', type: 'int', default: 48, min: 1, max: 1024, step: 1, flag: ['--spec-ngram-mod-n-min'], emit: 'value', when: ngram('ngram-mod') },
  { key: 'ngramModMax', label: 'ngram-mod: most tokens', group: 'load', section: 'speed', target: 'load', type: 'int', default: 64, min: 1, max: 1024, step: 1, flag: ['--spec-ngram-mod-n-max'], emit: 'value', when: ngram('ngram-mod') },
  { key: 'ngramModMatch', label: 'ngram-mod: lookup length', group: 'load', section: 'speed', target: 'load', type: 'int', default: 24, min: 1, max: 1024, step: 1, flag: ['--spec-ngram-mod-n-match'], emit: 'value', when: ngram('ngram-mod') },
  { key: 'ngramSimpleN', label: 'ngram-simple: lookup length', group: 'load', section: 'speed', target: 'load', type: 'int', default: 12, min: 1, max: 1024, step: 1, flag: ['--spec-ngram-simple-size-n'], emit: 'value', when: ngram('ngram-simple') },
  { key: 'ngramSimpleM', label: 'ngram-simple: draft length', group: 'load', section: 'speed', target: 'load', type: 'int', default: 48, min: 1, max: 1024, step: 1, flag: ['--spec-ngram-simple-size-m'], emit: 'value', when: ngram('ngram-simple') },
  { key: 'ngramSimpleHits', label: 'ngram-simple: fewest hits', group: 'load', section: 'speed', target: 'load', type: 'int', default: 1, min: 1, max: 100, step: 1, flag: ['--spec-ngram-simple-min-hits'], emit: 'value', when: ngram('ngram-simple') },
  { key: 'ngramMapN', label: 'ngram-map-k: lookup length', group: 'load', section: 'speed', target: 'load', type: 'int', default: 12, min: 1, max: 1024, step: 1, flag: ['--spec-ngram-map-k-size-n'], emit: 'value', when: ngram('ngram-map-k') },
  { key: 'ngramMapM', label: 'ngram-map-k: draft length', group: 'load', section: 'speed', target: 'load', type: 'int', default: 48, min: 1, max: 1024, step: 1, flag: ['--spec-ngram-map-k-size-m'], emit: 'value', when: ngram('ngram-map-k') },
  { key: 'ngramMapHits', label: 'ngram-map-k: fewest hits', group: 'load', section: 'speed', target: 'load', type: 'int', default: 1, min: 1, max: 100, step: 1, flag: ['--spec-ngram-map-k-min-hits'], emit: 'value', when: ngram('ngram-map-k') },
  { key: 'ngramMap4N', label: 'ngram-map-k4v: lookup length', group: 'load', section: 'speed', target: 'load', type: 'int', default: 12, min: 1, max: 1024, step: 1, flag: ['--spec-ngram-map-k4v-size-n'], emit: 'value', when: ngram('ngram-map-k4v') },
  { key: 'ngramMap4M', label: 'ngram-map-k4v: draft length', group: 'load', section: 'speed', target: 'load', type: 'int', default: 48, min: 1, max: 1024, step: 1, flag: ['--spec-ngram-map-k4v-size-m'], emit: 'value', when: ngram('ngram-map-k4v') },
  { key: 'ngramMap4Hits', label: 'ngram-map-k4v: fewest hits', group: 'load', section: 'speed', target: 'load', type: 'int', default: 1, min: 1, max: 100, step: 1, flag: ['--spec-ngram-map-k4v-min-hits'], emit: 'value', when: ngram('ngram-map-k4v') },
  { key: 'expertsUsed', label: 'Active experts per token', group: 'load', section: 'speed', target: 'load', type: 'int', default: 0, min: 0, max: 512, step: 1, needs: MOE, hint: "How many experts work on each token. 0 uses the model's own number. Fewer is faster and can be less smart." },
  { key: 'imageMinTokens', label: 'Fewest tokens per image', group: 'load', section: 'vision', target: 'load', type: 'int', default: 0, min: 0, max: 16384, step: 16, flag: ['--image-min-tokens'], emit: 'value', skip: [0], needs: VISION, hint: 'Only for vision models with dynamic resolution. 0 uses the model value.' },
  { key: 'imageMaxTokens', label: 'Most tokens per image', group: 'load', section: 'vision', target: 'load', type: 'int', default: 0, min: 0, max: 16384, step: 16, flag: ['--image-max-tokens'], emit: 'value', skip: [0], needs: VISION, hint: 'Only for vision models with dynamic resolution. Lower uses less context per picture. 0 uses the model value.' },
  { key: 'imageBatch', label: 'Image tokens per batch', group: 'load', section: 'vision', target: 'load', type: 'int', default: 1024, min: 16, max: 16384, step: 16, flag: ['--mtmd-batch-max-tokens'], emit: 'value', needs: VISION, hint: 'Most image tokens encoded at once.' },
  { key: 'projectorOnGpu', label: 'Vision adapter on GPU', group: 'load', section: 'vision', target: 'load', type: 'bool', default: true, flag: ['--mmproj-offload'], emit: 'off', needs: VISION, hint: 'Off keeps the vision adapter in RAM, freeing VRAM. Pictures are read slower.' },
  { key: 'projectorDevice', label: 'Vision adapter device', group: 'load', section: 'vision', target: 'load', type: 'text', default: '', flag: ['-mmdev', '--mmproj-device'], emit: 'value', needs: VISION, when: { any: [{ key: 'projectorOnGpu', values: [true] }], reason: 'Only with Vision adapter on GPU.' }, hint: 'Which device runs the vision adapter, e.g. CUDA1. Empty follows Devices.' },
  { key: 'videoFps', label: 'Video frames per second', group: 'load', section: 'vision', target: 'load', type: 'float', default: 4, min: 0.1, max: 60, step: 0.1, flag: ['--video-fps'], emit: 'value', needs: VISION, hint: 'Frames taken from a video. Seven does not send video yet.' },
  { key: 'loras', label: 'LoRA adapters', group: 'load', section: 'files', target: 'load', type: 'files', default: '', files: GGUF, flag: ['--lora-scaled', '--lora'], hint: 'Small add-on files that change how the model writes, each with a strength (1 is full).' },
  { key: 'controlVectors', label: 'Control vectors', group: 'load', section: 'files', target: 'load', type: 'files', default: '', files: GGUF, flag: ['--control-vector-scaled', '--control-vector'], hint: 'Files that push the model toward a style or mood, each with a strength.' },
  { key: 'controlFrom', label: 'Control vectors: first layer', group: 'load', section: 'files', target: 'load', type: 'int', default: 0, min: 0, max: 999, step: 1, when: { any: [{ key: 'controlVectors' }], reason: 'Add a control vector first.' }, hint: 'With Control vectors: last layer, the layers they apply to. Both 0 applies them to every layer.' },
  { key: 'controlTo', label: 'Control vectors: last layer', group: 'load', section: 'files', target: 'load', type: 'int', default: 0, min: 0, max: 999, step: 1, when: { any: [{ key: 'controlVectors' }], reason: 'Add a control vector first.' } },
  { key: 'reasoningPreserve', label: 'Keep thinking in history', group: 'load', section: 'thinking', target: 'load', type: 'bool', default: true, flag: ['--reasoning-preserve'], emit: 'both', hint: 'The model sees its own earlier thinking on later turns, for templates that support it. Uses more context.' },
  { key: 'reasoningEffort', label: 'Reasoning effort', group: 'load', section: 'thinking', target: 'load', type: 'select', default: 'default', options: ['default', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'], flag: ['--reasoning-effort'], emit: 'value', hint: "The effort level given to the chat template, for models whose template has one. default keeps the template's own." },
  { key: 'budgetMessage', label: 'When thinking runs out', group: 'load', section: 'thinking', target: 'load', type: 'text', default: '', flag: ['--reasoning-budget-message'], emit: 'value', hint: 'Text put in just before thinking is ended at the Low, Medium or High limit, e.g. "Time is up, answer now." Empty puts nothing.' },
  { key: 'thinking', label: 'Thinking', group: 'sampling', section: 'thinking', target: 'prompt', type: 'select', default: 'max', options: [...THINKING_LEVELS], boolMap: ['off', 'max'], hint: 'How much the model thinks before it replies. Off: the model is told not to think, through its chat template. Low, Medium and High: up to the token limits below (changing them reloads the model), and for remote OpenAI models that effort. Max: no limit. Only matters for models that think.' },
  { key: 'thinkingLow', label: 'Low: most thinking tokens', group: 'sampling', section: 'thinking', target: 'prompt', type: 'int', default: 1024, min: 0, max: 131072, step: 256, hint: 'How long the model may think at Low, in tokens. 0 means no limit. Remote Anthropic models use it as their thinking budget (at least 1024).' },
  { key: 'thinkingMedium', label: 'Medium: most thinking tokens', group: 'sampling', section: 'thinking', target: 'prompt', type: 'int', default: 4096, min: 0, max: 131072, step: 256, hint: 'How long the model may think at Medium, in tokens. 0 means no limit.' },
  { key: 'thinkingHigh', label: 'High: most thinking tokens', group: 'sampling', section: 'thinking', target: 'prompt', type: 'int', default: 16384, min: 0, max: 131072, step: 256, hint: 'How long the model may think at High, in tokens. 0 means no limit.' },
  { key: 'temperature', label: 'Temperature', group: 'sampling', section: 'sampling', target: 'prompt', type: 'float', default: 0.7, min: 0, max: 2, step: 0.05, flag: ['--temp', '--temperature'] },
  { key: 'topP', label: 'Top P', group: 'sampling', section: 'sampling', target: 'prompt', type: 'float', default: 0.9, min: 0, max: 1, step: 0.01, flag: ['--top-p'] },
  { key: 'topK', label: 'Top K', group: 'sampling', section: 'sampling', target: 'prompt', type: 'int', default: 40, min: 0, max: 200, step: 1, flag: ['--top-k'] },
  { key: 'minP', label: 'Min P', group: 'sampling', section: 'sampling', target: 'prompt', type: 'float', default: 0.05, min: 0, max: 1, step: 0.01, flag: ['--min-p'] },
  { key: 'seed', label: 'Seed', group: 'sampling', section: 'sampling', target: 'prompt', type: 'int', default: -1, min: -1, max: 2147483647, step: 1, flag: ['-s', '--seed'], hint: '-1 picks a new one each time. A fixed number gives the same reply to the same chat.' },
  { key: 'maxTokens', label: 'Max reply tokens', group: 'sampling', section: 'sampling', target: 'prompt', type: 'int', default: 0, min: 0, max: 32768, step: 64, flag: ['-n', '--n-predict', '--predict'], hint: '0 means no limit beyond the context.' },
  { key: 'topNSigma', label: 'Top-n-sigma', group: 'load', section: 'sampling', target: 'load', type: 'float', default: -1, min: -1, max: 10, step: 0.1, flag: ['--top-nsigma', '--top-n-sigma'], emit: 'value', hint: 'Keeps only tokens within this many standard deviations of the best. -1 turns it off. Applies to every chat with this model.' },
  { key: 'typicalP', label: 'Typical P', group: 'load', section: 'sampling', target: 'load', type: 'float', default: 1, min: 0, max: 1, step: 0.01, flag: ['--typical', '--typical-p'], emit: 'value', hint: 'Locally typical sampling. 1 turns it off. Applies to every chat with this model.' },
  { key: 'dynatempRange', label: 'Dynamic temperature range', group: 'load', section: 'sampling', target: 'load', type: 'float', default: 0, min: 0, max: 2, step: 0.05, flag: ['--dynatemp-range'], emit: 'value', hint: 'Temperature moves up and down by this much depending on how sure the model is. 0 turns it off.' },
  { key: 'dynatempExp', label: 'Dynamic temperature exponent', group: 'load', section: 'sampling', target: 'load', type: 'float', default: 1, min: 0, max: 10, step: 0.1, flag: ['--dynatemp-exp'], emit: 'value', when: { any: [{ key: 'dynatempRange' }], reason: 'Only with a dynamic temperature range.' } },
  { key: 'mirostat', label: 'Mirostat', group: 'load', section: 'sampling', target: 'load', type: 'int', default: 0, min: 0, max: 2, step: 1, flag: ['--mirostat'], emit: 'value', hint: '0 off, 1 Mirostat, 2 Mirostat 2.0. When on, Top K, Top P and Typical P are ignored.' },
  { key: 'mirostatLr', label: 'Mirostat learning rate', group: 'load', section: 'sampling', target: 'load', type: 'float', default: 0.1, min: 0, max: 1, step: 0.01, flag: ['--mirostat-lr'], emit: 'value', when: { any: [{ key: 'mirostat' }], reason: 'Only with Mirostat on.' } },
  { key: 'mirostatEnt', label: 'Mirostat target entropy', group: 'load', section: 'sampling', target: 'load', type: 'float', default: 5, min: 0, max: 20, step: 0.1, flag: ['--mirostat-ent'], emit: 'value', when: { any: [{ key: 'mirostat' }], reason: 'Only with Mirostat on.' } },
  { key: 'adaptiveTarget', label: 'Adaptive-p target', group: 'load', section: 'sampling', target: 'load', type: 'float', default: -1, min: -1, max: 1, step: 0.01, flag: ['--adaptive-target'], emit: 'value', hint: 'Picks tokens near this probability. Negative turns it off.' },
  { key: 'adaptiveDecay', label: 'Adaptive-p decay', group: 'load', section: 'sampling', target: 'load', type: 'float', default: 0.9, min: 0, max: 0.99, step: 0.01, flag: ['--adaptive-decay'], emit: 'value', when: { any: [{ key: 'adaptiveTarget' }], reason: 'Only with an adaptive-p target.' }, hint: 'Lower reacts faster, higher is steadier.' },
  { key: 'samplers', label: 'Sampler order', group: 'load', section: 'sampling', target: 'load', type: 'text', default: '', flag: ['--samplers'], emit: 'value', hint: 'Samplers in order, separated by ;. Empty uses penalties;dry;top_n_sigma;top_k;typ_p;top_p;min_p;xtc;temperature.' },
  { key: 'ignoreEos', label: 'Ignore end of reply', group: 'load', section: 'sampling', target: 'load', type: 'bool', default: false, flag: ['--ignore-eos'], emit: 'on', hint: 'The model keeps writing past where it would stop. Only for testing.' },
  { key: 'logitBias', label: 'Token bias', group: 'load', section: 'sampling', target: 'load', type: 'text', default: '', hint: 'Space-separated TOKEN_ID+BIAS or TOKEN_ID-BIAS, e.g. "15043+1 2-inf". Makes those tokens more or less likely.' },
  { key: 'repeatPenalty', label: 'Repeat penalty', group: 'sampling', section: 'repetition', target: 'prompt', type: 'float', default: 1.1, min: 1, max: 2, step: 0.01, flag: ['--repeat-penalty'], hint: '1 turns it off.' },
  { key: 'frequencyPenalty', label: 'Frequency penalty', group: 'sampling', section: 'repetition', target: 'prompt', type: 'float', default: 0, min: 0, max: 2, step: 0.01, flag: ['--frequency-penalty'], hint: 'Lowers a token more the more often it has appeared. 0 turns it off.' },
  { key: 'presencePenalty', label: 'Presence penalty', group: 'sampling', section: 'repetition', target: 'prompt', type: 'float', default: 0, min: 0, max: 2, step: 0.01, flag: ['--presence-penalty'], hint: 'Lowers any token that has appeared at all. 0 turns it off.' },
  { key: 'penaltyTokens', label: 'Penalty window', group: 'sampling', section: 'repetition', target: 'prompt', type: 'int', default: 64, min: 1, max: 4096, step: 16, flag: ['--repeat-last-n'], hint: 'How many recent tokens the repeat, frequency and presence penalties look at.' },
  { key: 'dryStrength', label: 'DRY strength', group: 'sampling', section: 'repetition', target: 'prompt', type: 'float', default: 0, min: 0, max: 5, step: 0.05, flag: ['--dry-multiplier'], hint: "Don't Repeat Yourself: stops the model repeating whole phrases. 0 turns it off; 0.8 is a common start." },
  { key: 'dryBase', label: 'DRY base', group: 'sampling', section: 'repetition', target: 'prompt', type: 'float', default: 1.75, min: 1, max: 4, step: 0.05, flag: ['--dry-base'], hint: 'How fast the DRY penalty grows with the length of a repeat.' },
  { key: 'dryAllowedLength', label: 'DRY allowed length', group: 'sampling', section: 'repetition', target: 'prompt', type: 'int', default: 2, min: 1, max: 20, step: 1, flag: ['--dry-allowed-length'], hint: 'Repeats up to this many tokens long are not penalised.' },
  { key: 'dryWindow', label: 'DRY window', group: 'load', section: 'repetition', target: 'load', type: 'int', default: 64, min: 0, max: 8192, step: 16, flag: ['--dry-penalty-last-n'], emit: 'value', hint: 'How many recent tokens DRY looks at. 0 turns the window off.' },
  { key: 'dryBreakers', label: 'DRY sequence breakers', group: 'load', section: 'repetition', target: 'load', type: 'text', default: '', hint: 'Space-separated strings that end a repeat, e.g. \\n : " *. Empty keeps those defaults; none uses no breakers.' },
  { key: 'xtcProbability', label: 'XTC probability', group: 'sampling', section: 'advanced', target: 'prompt', type: 'float', default: 0, min: 0, max: 1, step: 0.01, flag: ['--xtc-probability'], hint: 'Exclude Top Choices: the chance each step of dropping the most likely tokens, for more varied writing. 0 turns it off; 0.5 is a common start.' },
  { key: 'xtcThreshold', label: 'XTC threshold', group: 'sampling', section: 'advanced', target: 'prompt', type: 'float', default: 0.1, min: 0, max: 1, step: 0.01, flag: ['--xtc-threshold'], hint: 'Tokens at least this likely can be dropped by XTC.' }
]

const byKey = new Map(PARAMS.map((p) => [p.key, p]))

export function defaults(): ModelConfig {
  const out: ModelConfig = {}
  for (const p of PARAMS) out[p.key] = p.default
  return out
}

function coerce(def: ParamDef, value: unknown): ParamValue {
  if (def.boolMap && typeof value === 'boolean') return value ? def.boolMap[1] : def.boolMap[0]
  if (def.type === 'bool') return value === true || value === 'true'
  if (def.type === 'text' || def.type === 'file' || def.type === 'files') return typeof value === 'string' ? value.trim() : def.default
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

function thinkingOptions(config: ModelConfig): Pick<PromptSampling, 'budgets' | 'effort'> {
  const level = thinkingLevel(config)
  if (level === 'off') return {}
  if (level === 'max') return {}
  const cap = Number(config[BUDGET[level]]) || 0
  return { effort: level, ...(cap > 0 ? { budgets: { thoughtTokens: cap } } : {}) }
}

export function promptOptions(config: ModelConfig, overrides: SamplingOverrides): PromptSampling {
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
    ...thinkingOptions(merged)
  }
}


export interface ServerModel {
  mtpLayers: number | null
  mmproj: string | null
  architecture: string | null
  template: string | null
  traits: ModelTraitSet
}

export function templateFile(template: string): string {
  return path.join(os.tmpdir(), `seven-template-${crypto.createHash('sha1').update(template).digest('hex').slice(0, 16)}.jinja`)
}

function emitted(def: ParamDef, value: ParamValue): string[] {
  const flag = def.flag?.find((f) => f.startsWith('--')) ?? def.flag?.[0]
  if (!flag || !def.emit) return []
  if (def.emit === 'on') return value === true ? [flag] : []
  if (def.emit === 'off') return value === false ? [`--no-${flag.replace(/^--?/, '')}`] : []
  if (def.emit === 'both') return [value === true ? flag : `--no-${flag.replace(/^--?/, '')}`]
  if ((def.skip ?? [def.default]).includes(value) || value === '') return []
  return [flag, def.type === 'select' ? String(value).toLowerCase() : String(value)]
}

export function serverArgs(config: ModelConfig, model: ServerModel): string[] {
  const args = ['--no-webui', '--jinja', '--context-shift', '-np', '1']
  const active = (key: string): boolean => {
    const def = byKey.get(key)
    return Boolean(def) && !paramBlock(def!, config, model.traits, byKey)
  }
  for (const def of PARAMS) if (def.emit && active(def.key)) args.push(...emitted(def, config[def.key] ?? def.default))
  const experts = Number(config.expertsUsed) || 0
  if (experts > 0 && model.architecture && active('expertsUsed')) args.push('--override-kv', `${model.architecture}.expert_used_count=int:${experts}`)
  const draft = String(config.draftModel ?? '').trim()
  const draftType = active('draftType') ? String(config.draftType ?? 'none') : 'none'
  const spec = [
    ...(config.mtp !== false && model.mtpLayers && active('mtp') ? ['draft-mtp'] : []),
    ...(draft && draftType !== 'none' ? [draftType] : []),
    ...(String(config.ngram ?? 'none') !== 'none' ? [String(config.ngram)] : [])
  ]
  if (spec.length) args.push('--spec-type', spec.join(','))
  if (draft && draftType !== 'none') args.push('-md', draft)
  const loras = fileList(config.loras)
  if (loras.length) args.push('--lora-scaled', fileListFlag(loras))
  const vectors = fileList(config.controlVectors)
  if (vectors.length) {
    args.push('--control-vector-scaled', fileListFlag(vectors))
    const from = Number(config.controlFrom) || 0
    const to = Number(config.controlTo) || 0
    if (from > 0 || to > 0) args.push('--control-vector-layer-range', String(from), String(to))
  }
  for (const breaker of String(config.dryBreakers ?? '').split(/\s+/).filter(Boolean)) args.push('--dry-sequence-breaker', breaker)
  for (const bias of String(config.logitBias ?? '').split(/\s+/).filter(Boolean)) args.push('-l', bias)
  if (model.mmproj) args.push('--mmproj', model.mmproj)
  if (model.template) args.push('--chat-template-file', templateFile(model.template))
  const level = thinkingLevel(config)
  const cap = level === 'low' || level === 'medium' || level === 'high' ? Number(config[BUDGET[level]]) || 0 : 0
  if (cap > 0) args.push('--reasoning-budget', String(cap))
  return args
}
export function serverSampling(s: PromptSampling, level: ThinkingLevel): Record<string, unknown> {
  return {
    top_k: s.topK,
    min_p: s.minP,
    repeat_penalty: s.repeatPenalty ? s.repeatPenalty.penalty : 1,
    frequency_penalty: s.repeatPenalty ? s.repeatPenalty.frequencyPenalty : 0,
    presence_penalty: s.repeatPenalty ? s.repeatPenalty.presencePenalty : 0,
    ...(s.repeatPenalty ? { repeat_last_n: s.repeatPenalty.lastTokens } : {}),
    ...(s.dryRepeatPenalty ? { dry_multiplier: s.dryRepeatPenalty.strength, dry_base: s.dryRepeatPenalty.base, dry_allowed_length: s.dryRepeatPenalty.allowedLength } : {}),
    ...(s.xtc ? { xtc_probability: s.xtc.probability, xtc_threshold: s.xtc.threshold } : {}),
    ...(s.seed !== undefined ? { seed: s.seed } : {}),
    chat_template_kwargs: { enable_thinking: level !== 'off' }
  }
}
