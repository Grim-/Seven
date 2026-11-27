import type { ModelKind } from '@shared/types'
import { resolveChatTemplate } from './chatTemplate'
import { text, type GgufView } from '../view'

const BY_TYPE: Record<string, ModelKind> = {
  imatrix: 'imatrix',
  mmproj: 'projector',
  vae: 'vae',
  lora: 'lora',
  adapter: 'lora',
  control_vector: 'control_vector',
  controlvector: 'control_vector',
  text_encoder: 'text_encoder',
  diffusion: 'image'
}

const DIFFUSION_ARCH =
  /^(flux(?:[-_.]?\w+)*|sd(?:[-_.]?\d+|xl)?(?:[-_.]?\w+)*|stable[-_]?diffusion.*|qwen[-_]?image.*|chroma.*|wan(?:[-_.]?\d+)*.*|z[-_]?image.*|zimage.*|kontext.*|klein.*|lumina.*|hunyuan.*|aura[-_]?flow.*|pixart.*|cosmos.*|ltx.*|mochi.*|cogvideo.*|omnigen.*|hidream.*|sana.*|anima.*|bagel.*|ernie[-_]?image.*|ovis[-_]?image.*|kolors.*|kandinsky.*|playground.*|seedvr.*|longcat.*|neta.*|mmdit|dit|unet)$/i
const ENCODER_ARCH = /^(t5|t5encoder|umt5|clip)$/i

function hasControlVectorTensors(names: string[]): boolean {
  return names.length > 0 && names.every((n) => /^direction\.\d+$/.test(n) || /^control_vector\./.test(n))
}

function hasLoraTensors(names: string[]): boolean {
  return names.some((n) => n.includes('.lora_a') || n.includes('.lora_b') || n.includes('.lora_down') || n.includes('.lora_up') || n.startsWith('lora_unet') || n.startsWith('lora_te'))
}

function hasDiffusionTensors(names: string[]): boolean {
  return names.some(
    (n) =>
      n.startsWith('double_blocks.') ||
      n.startsWith('single_blocks.') ||
      n.startsWith('joint_blocks.') ||
      n.startsWith('transformer_blocks.') ||
      n.startsWith('single_transformer_blocks.') ||
      n.startsWith('model.diffusion_model.') ||
      n.startsWith('diffusion_model.') ||
      n.startsWith('time_in.') ||
      n.startsWith('guidance_in.') ||
      n.startsWith('time_embed.') ||
      n.startsWith('time_embedding.') ||
      n.startsWith('time_text_embed.') ||
      n.startsWith('t_embedder.') ||
      n.startsWith('x_embedder.') ||
      n.startsWith('context_embedder.') ||
      n.startsWith('cap_embedder.') ||
      n.startsWith('patch_embedding.') ||
      n.startsWith('noise_refiner.') ||
      n.startsWith('context_refiner.') ||
      n.startsWith('img_in.') ||
      n.startsWith('txt_in.') ||
      n.startsWith('input_blocks.') ||
      n.startsWith('output_blocks.') ||
      n.startsWith('down_blocks.') ||
      n.startsWith('up_blocks.') ||
      n.startsWith('mid_block.') ||
      n.includes('.adaLN_modulation.') ||
      n.includes('.img_mod.') ||
      n.includes('.txt_mod.')
  )
}

function hasVaeTensors(names: string[]): boolean {
  return names.length > 0 && names.some((n) => n.startsWith('first_stage_model.') || n.startsWith('encoder.conv_in.') || n.startsWith('decoder.conv_out.')) && !hasDiffusionTensors(names)
}

export function resolveKind(v: GgufView): ModelKind {
  const declared = text(v.general.type)?.toLowerCase()
  const adapterType = text(v.adapter.type)?.toLowerCase()
  if (adapterType === 'control_vector' || adapterType === 'controlvector') return 'control_vector'
  if (adapterType === 'lora') return 'lora'
  if (declared && BY_TYPE[declared]) return BY_TYPE[declared]
  if (hasControlVectorTensors(v.tensorNames)) return 'control_vector'
  if (hasLoraTensors(v.tensorNames)) return 'lora'
  if (v.architecture && DIFFUSION_ARCH.test(v.architecture)) return 'image'
  if (hasDiffusionTensors(v.tensorNames)) return 'image'
  if (hasVaeTensors(v.tensorNames)) return 'vae'
  if (v.architecture && ENCODER_ARCH.test(v.architecture) && !resolveChatTemplate(v)) return 'text_encoder'
  if (v.arch.pooling_type !== undefined) return 'embedding'
  return v.architecture ? 'chat' : 'other'
}
