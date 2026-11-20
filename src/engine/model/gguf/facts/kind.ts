import type { ModelKind } from '@shared/types'
import { resolveChatTemplate } from './chatTemplate'
import { text, type GgufView } from '../view'

const BY_TYPE: Record<string, ModelKind> = {
  imatrix: 'imatrix',
  mmproj: 'projector',
  vae: 'vae',
  lora: 'lora',
  adapter: 'lora',
  text_encoder: 'text_encoder',
  diffusion: 'image'
}

const DIFFUSION_ARCH =
  /^(flux(?:\.\d+)?|flux1|sd(?:\d+|xl)?|stable[-_]?diffusion.*|qwen_image|chroma|wan|z_image|kontext|lumina\d*|hunyuan(?:_dit)?|aura_?flow|pixart.*|cosmos|ltxv|mochi|cogvideo.*|omnigen.*|hidream.*|sana|anima|bagel|ernie_image)$/i
const ENCODER_ARCH = /^(t5|t5encoder|umt5|clip)$/i

function hasLoraTensors(names: string[]): boolean {
  return names.some((n) => n.includes('.lora_a') || n.includes('.lora_b') || n.includes('.lora_down') || n.includes('.lora_up') || n.startsWith('lora_unet') || n.startsWith('lora_te'))
}

function hasDiffusionTensors(names: string[]): boolean {
  return names.some(
    (n) =>
      n.startsWith('double_blocks.') ||
      n.startsWith('single_blocks.') ||
      n.startsWith('joint_blocks.') ||
      n.startsWith('model.diffusion_model.') ||
      n.startsWith('diffusion_model.') ||
      n.startsWith('time_in.') ||
      n.startsWith('guidance_in.')
  )
}

function hasVaeTensors(names: string[]): boolean {
  return names.length > 0 && names.some((n) => n.startsWith('first_stage_model.') || n.startsWith('encoder.conv_in.') || n.startsWith('decoder.conv_out.')) && !hasDiffusionTensors(names)
}

export function resolveKind(v: GgufView): ModelKind {
  const declared = text(v.general.type)?.toLowerCase()
  const adapterType = text(v.adapter.type)?.toLowerCase()
  if (adapterType === 'lora') return 'lora'
  if (declared && BY_TYPE[declared]) return BY_TYPE[declared]
  if (hasLoraTensors(v.tensorNames)) return 'lora'
  if (v.architecture && DIFFUSION_ARCH.test(v.architecture)) return 'image'
  if (hasDiffusionTensors(v.tensorNames)) return 'image'
  if (hasVaeTensors(v.tensorNames)) return 'vae'
  if (v.architecture && ENCODER_ARCH.test(v.architecture) && !resolveChatTemplate(v)) return 'text_encoder'
  if (v.arch.pooling_type !== undefined) return 'embedding'
  return v.architecture ? 'chat' : 'other'
}
