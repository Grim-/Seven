import fs from 'node:fs'
import path from 'node:path'
import type { ModelInfo, ModelKind } from '@shared/types'
import { noteFailure } from '../util/report'
import { hubUrl, readHeader, type HeaderRead } from './gguf/read'

export const MODEL_EXTENSIONS = new Set(['.gguf', '.safetensors', '.sft', '.ckpt'])
export const DIFFUSION_EXTENSIONS = new Set(['.safetensors', '.sft', '.ckpt'])
const MAX_SAFETENSORS_HEADER = 8 * 1024 * 1024

export function isModelFile(filePath: string): boolean {
  return MODEL_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

export function isGgufFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.gguf'
}

function emptyInfo(kind: ModelKind, name: string | null, architecture: string | null, sizeBytes: number | null): ModelInfo {
  return {
    kind,
    architecture,
    name,
    sizeLabel: null,
    author: null,
    license: null,
    contextLength: null,
    layers: null,
    embeddingLength: null,
    chatTemplate: false,
    imatrix: null,
    experts: null,
    mtpLayers: null,
    slidingWindow: null,
    quant: null,
    split: null,
    sizeBytes
  }
}

function resolveRemote(source: string, how: HeaderRead): { url: string; headers: Record<string, string>; local: boolean } {
  const headers: Record<string, string> = how.tokens?.huggingFace ? { Authorization: `Bearer ${how.tokens.huggingFace}` } : {}
  const hf = source.match(/^hf:([^/]+\/[^/]+)\/(.+)$/)
  if (hf) return { url: hubUrl(hf[1], hf[2]), headers, local: false }
  return { url: source, headers, local: !/^https?:\/\//i.test(source) }
}

async function totalFileSize(source: string, how: HeaderRead): Promise<number | null> {
  const { url, headers, local } = resolveRemote(source, how)
  if (local) return fs.statSync(url).size
  const res = await fetch(url, { method: 'HEAD', headers })
  const size = Number(res.headers.get('x-linked-size') ?? res.headers.get('content-length'))
  return res.ok && Number.isFinite(size) && size > 0 ? size : null
}

async function readByteRange(source: string, how: HeaderRead, start: number, length: number): Promise<Buffer> {
  const { url, headers, local } = resolveRemote(source, how)
  if (local) {
    const fd = fs.openSync(url, 'r')
    try {
      const buf = Buffer.alloc(length)
      const read = fs.readSync(fd, buf, 0, length, start)
      return buf.subarray(0, read)
    } finally {
      fs.closeSync(fd)
    }
  }
  const end = start + length - 1
  const res = await fetch(url, { headers: { ...headers, Range: `bytes=${start}-${end}` } })
  if (!res.ok) throw new Error(`HTTP ${res.status} while reading safetensors header`)
  return Buffer.from(await res.arrayBuffer())
}

function kindFromName(name: string): { kind: ModelKind; architecture: string | null } {
  const lower = name.toLowerCase().replace(/\\/g, '/')
  if (/(^|[/_.\-])(control[-_]?vector|control[-_]?vectors|cvector)([/_.\-]|$)/.test(lower)) return { kind: 'control_vector', architecture: 'control-vector' }
  if (/(^|[/_.\-])(lora|loras|lycoris|dora|lokr|loha)([/_.\-]|$)/.test(lower)) return { kind: 'lora', architecture: 'lora' }
  if (/mmproj/i.test(lower)) return { kind: 'projector', architecture: 'clip-vision' }
  if (/(^|[/_.\-])(vae|vaes|vae_approx|taesd|taef1|taeqi|taehv|taew)([/_.\-]|$)/.test(lower) || /(^|\/)(ae|flux2-vae|qwen_image_vae|qwen_image_2\.1_vae.*|sdxl_vae)\.(safetensors|sft|ckpt)$/.test(lower)) {
    return { kind: 'vae', architecture: 'vae' }
  }
  if (/(^|\/)text_encoders?\//.test(lower) || /(clip[-_]?[lg]|t5xxl|umt5|qwen[_.\-]?2\.5[_.\-]?vl|qwen[_.\-]?3[_.\-]?(4b|8b|vl)|mistral[-_]?small|gemma[-_]?2)/.test(lower)) {
    return { kind: 'text_encoder', architecture: lower.includes('t5') ? 't5' : /(qwen|mistral|gemma)/.test(lower) ? 'llm' : 'clip' }
  }
  if (lower.includes('flux2') || lower.includes('flux-2') || lower.includes('flux_2') || lower.includes('klein')) return { kind: 'image', architecture: 'flux2' }
  if (lower.includes('flux')) return { kind: 'image', architecture: 'flux' }
  if (lower.includes('z_image') || lower.includes('z-image')) return { kind: 'image', architecture: 'z_image' }
  if (lower.includes('sd3')) return { kind: 'image', architecture: 'sd3' }
  if (lower.includes('sdxl') || lower.includes('illustrious') || lower.includes('pony') || /(^|[/_.\-])xl([/_.\-]|$)/.test(lower)) return { kind: 'image', architecture: 'sdxl' }
  if (lower.includes('qwen') && (lower.includes('2.1') || lower.includes('2_1'))) return { kind: 'image', architecture: 'qwen_image_21' }
  if (lower.includes('qwen') && lower.includes('image')) return { kind: 'image', architecture: 'qwen_image' }
  if (lower.includes('wan')) return { kind: 'image', architecture: 'wan' }
  if (lower.includes('chroma')) return { kind: 'image', architecture: 'chroma' }
  return { kind: 'image', architecture: 'stable-diffusion' }
}

function classifySafetensors(header: Record<string, unknown>, baseName: string, relHint: string, sizeBytes: number | null): ModelInfo {
  const meta = header.__metadata__ && typeof header.__metadata__ === 'object' && !Array.isArray(header.__metadata__) ? (header.__metadata__ as Record<string, unknown>) : {}
  const keys = Object.keys(header).filter((k) => k !== '__metadata__')
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

  const specArch = str(meta['modelspec.architecture']) ?? str(meta.ss_base_model_version) ?? str(meta.architecture)
  const name = str(meta['modelspec.title']) ?? str(meta.ss_output_name) ?? baseName
  const author = str(meta['modelspec.author'])
  const license = str(meta['modelspec.license'])

  const hasLora =
    Boolean(meta.ss_network_module || meta.ss_network_dim || meta.ss_network_alpha || meta.lycoris_version) ||
    keys.some(
      (k) =>
        k.includes('.lora_down.') ||
        k.includes('.lora_up.') ||
        k.includes('.lora_A.') ||
        k.includes('.lora_B.') ||
        k.includes('.lora.down.') ||
        k.includes('.lora.up.') ||
        k.includes('.hada_w1') ||
        k.includes('.lokr_w1') ||
        k.includes('.loha_') ||
        k.startsWith('lora_unet') ||
        k.startsWith('lora_te') ||
        k.startsWith('lora_transformer')
    )
  const hasDiffusion = keys.some(
    (k) =>
      k.startsWith('model.diffusion_model.') ||
      k.startsWith('diffusion_model.') ||
      k.startsWith('double_blocks.') ||
      k.startsWith('single_blocks.') ||
      k.startsWith('joint_blocks.') ||
      k.startsWith('transformer_blocks.') ||
      k.startsWith('single_transformer_blocks.') ||
      k.startsWith('time_in.') ||
      k.startsWith('guidance_in.') ||
      k.startsWith('time_embed.') ||
      k.startsWith('time_embedding.') ||
      k.startsWith('img_in.') ||
      k.startsWith('txt_in.') ||
      k.startsWith('input_blocks.') ||
      k.startsWith('output_blocks.') ||
      k.startsWith('down_blocks.') ||
      k.startsWith('up_blocks.') ||
      k.startsWith('mid_block.') ||
      k.startsWith('x_embedder.') ||
      k.startsWith('context_embedder.') ||
      k.startsWith('patch_embedding.')
  )
  const hasVae = keys.some(
    (k) =>
      k.startsWith('first_stage_model.') ||
      k.startsWith('encoder.conv_in.') ||
      k.startsWith('encoder.down_blocks.') ||
      k.startsWith('decoder.conv_out.') ||
      k.startsWith('decoder.up_blocks.') ||
      k.startsWith('quant_conv.') ||
      k.startsWith('post_quant_conv.')
  )
  const hasLlm = keys.some((k) => k.startsWith('model.layers.') && (k.includes('.self_attn.') || k.includes('.mlp.')))
  const hasText = keys.some((k) => k.startsWith('text_model.') || k.startsWith('encoder.block.') || k.startsWith('cond_stage_model.') || k.startsWith('text_encoders.'))

  const byName = kindFromName(relHint)
  let kind: ModelKind = byName.kind
  let architecture: string | null = specArch ?? byName.architecture

  if (hasLora || specArch?.toLowerCase().includes('lora') || byName.kind === 'lora') {
    kind = 'lora'
    architecture = specArch ?? 'lora'
  } else if (hasDiffusion) {
    kind = 'image'
    if (keys.some((k) => k.startsWith('double_blocks.') || k.startsWith('single_blocks.') || k.startsWith('single_transformer_blocks.'))) {
      architecture = specArch ?? byName.architecture ?? 'flux'
    } else if (keys.some((k) => k.startsWith('joint_blocks.'))) {
      architecture = specArch ?? 'sd3'
    } else if (keys.some((k) => k.startsWith('conditioner.embedders.'))) {
      architecture = specArch ?? 'sdxl'
    } else {
      architecture = specArch ?? byName.architecture ?? 'stable-diffusion'
    }
  } else if (byName.kind === 'text_encoder') {
    kind = 'text_encoder'
    architecture = specArch ?? byName.architecture
  } else if (hasLlm && !hasText) {
    kind = 'chat'
    architecture = specArch ?? byName.architecture
  } else if (hasVae && !hasText) {
    kind = 'vae'
    architecture = specArch ?? 'vae'
  } else if (hasText && !hasDiffusion) {
    kind = 'text_encoder'
    architecture = specArch ?? (keys.some((k) => k.startsWith('encoder.block.')) ? 't5' : 'clip')
  }

  return {
    ...emptyInfo(kind, name, architecture, sizeBytes),
    author,
    license
  }
}

function sourceHint(source: string): string {
  const hf = source.match(/^hf:[^/]+\/[^/]+\/(.+)$/)
  if (hf) return hf[1]
  // Preserve last two path segments locally (e.g. vae/ae.safetensors or text_encoders/clip_l.safetensors)
  const parts = source.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts.slice(-2).join('/')
}

async function readSafetensorsInfo(source: string, how: HeaderRead): Promise<ModelInfo> {
  const baseName = path.basename(source)
  const hintPath = sourceHint(source)
  const fileSize = how.size
    ? await totalFileSize(source, how).catch((err: unknown) => (noteFailure(err, 'models', `Could not read file size for ${baseName}`), null))
    : null
  try {
    const lenBuf = await readByteRange(source, how, 0, 8)
    if (lenBuf.length < 8) {
      const hint = kindFromName(hintPath)
      return emptyInfo(hint.kind, baseName, hint.architecture, fileSize)
    }
    const headerLenBig = lenBuf.readBigUInt64LE(0)
    const headerLen = Number(headerLenBig)
    if (!Number.isFinite(headerLen) || headerLen <= 2 || headerLen > MAX_SAFETENSORS_HEADER) {
      const hint = kindFromName(hintPath)
      return emptyInfo(hint.kind, baseName, hint.architecture, fileSize)
    }
    const jsonBuf = await readByteRange(source, how, 8, headerLen)
    const header = JSON.parse(jsonBuf.toString('utf8')) as Record<string, unknown>
    const weightBytes = fileSize !== null ? Math.max(0, fileSize - 8 - headerLen) : null
    return classifySafetensors(header, path.basename(baseName, path.extname(baseName)), hintPath, weightBytes)
  } catch (err) {
    noteFailure(err, 'models', `Could not read safetensors metadata for ${baseName}`)
    const hint = kindFromName(hintPath)
    return emptyInfo(hint.kind, path.basename(baseName, path.extname(baseName)), hint.architecture, fileSize)
  }
}

export async function readModelInfo(source: string, how: HeaderRead): Promise<ModelInfo> {
  if (isGgufFile(source)) return readHeader(source, how)
  const ext = path.extname(source).toLowerCase()
  if (ext === '.safetensors' || ext === '.sft') return readSafetensorsInfo(source, how)
  const base = path.basename(source, ext)
  const hint = kindFromName(sourceHint(source))
  const size = how.size
    ? await totalFileSize(source, how).catch((err: unknown) => (noteFailure(err, 'models', `Could not read file size for ${path.basename(source)}`), null))
    : null
  return emptyInfo(hint.kind, base, ext === '.ckpt' ? 'checkpoint' : hint.architecture, size)
}
