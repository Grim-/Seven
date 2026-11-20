import type { CompanionRole, ImageModelConfig } from './types'

export const IMAGE_SAMPLERS: { value: string; label: string; group: string; note: string }[] = [
  { value: 'euler', label: 'Euler', group: 'Recommended', note: 'Fast default for Flux, Z-Image & SD 3.5' },
  { value: 'euler_a', label: 'Euler Ancestral', group: 'Recommended', note: 'Good for SD 1.5, SDXL & SD-Turbo' },
  { value: 'heun', label: 'Heun', group: 'Classic', note: 'Higher-order deterministic sampler' },
  { value: 'dpm2', label: 'DPM2', group: 'Classic', note: 'Second-order solver' },
  { value: 'dpm++2s_a', label: 'DPM++ 2S Ancestral', group: 'Classic', note: 'Crisp details with stochastic step' },
  { value: 'dpm++2m', label: 'DPM++ 2M', group: 'Recommended', note: 'Strong quality at 15–30 steps' },
  { value: 'dpm++2mv2', label: 'DPM++ 2M v2', group: 'Classic', note: 'Refined DPM++ 2M schedule' },
  { value: 'ipndm', label: 'iPNDM', group: 'Fast', note: 'Multi-step predictor-corrector' },
  { value: 'ipndm_v', label: 'iPNDM v', group: 'Fast', note: 'Variable-step iPNDM' },
  { value: 'lcm', label: 'LCM', group: 'Fast', note: 'Distilled 4–8 step Latent Consistency' },
  { value: 'ddim_trailing', label: 'DDIM Trailing', group: 'Fast', note: 'Trailing timesteps for distilled checkpoints' },
  { value: 'tcd', label: 'TCD', group: 'Fast', note: 'Trajectory Consistency Distillation' }
]

export const IMAGE_SAMPLER_NAMES: string[] = IMAGE_SAMPLERS.map((s) => s.value)

export type CompanionSlot = 'vae' | 'tae' | 'clipL' | 'clipG' | 't5xxl' | 'llm' | 'llmVision'

export interface ImageCompanionSlotSpec {
  slot: CompanionSlot
  role: CompanionRole
  label: string
  flag: string
  matchPattern: string
  optional?: boolean
}

export interface ImageRecipeDefaults {
  mode: ImageModelConfig['mode']
  width: number
  height: number
  steps: number
  cfgScale: number
  sampler: string
}

export interface ImageArchSpec {
  id: string
  label: string
  modular: boolean
  /** Decode slots accept either a full --vae OR a tiny --taesd. */
  vaeOrTae?: boolean
  defaults: ImageRecipeDefaults
  slots: ImageCompanionSlotSpec[]
}

const VAE_FLUX1: ImageCompanionSlotSpec = {
  slot: 'vae',
  role: 'vae',
  label: 'FLUX.1 VAE (ae.safetensors)',
  flag: '--vae',
  matchPattern: '(^|[/\\\\_\\-])ae\\.(safetensors|sft|ckpt)$|flux[_\\-]?1.*vae|flux.*ae'
}

const VAE_FLUX2: ImageCompanionSlotSpec = {
  slot: 'vae',
  role: 'vae',
  label: 'FLUX.2 VAE (flux2-vae.safetensors)',
  flag: '--vae',
  matchPattern: 'flux[-_]?2[-_]?vae|flux2[-_]?vae'
}

const VAE_QWEN_IMAGE: ImageCompanionSlotSpec = {
  slot: 'vae',
  role: 'vae',
  label: 'Qwen Image VAE',
  flag: '--vae',
  matchPattern: 'qwen[-_]?image[-_]?vae'
}

const VAE_QWEN_21: ImageCompanionSlotSpec = {
  slot: 'vae',
  role: 'vae',
  label: 'Qwen Image 2.1 VAE',
  flag: '--vae',
  matchPattern: 'qwen[-_]?image[-_]?2[._]?1[-_]?vae'
}

const TAE_OPTIONAL: ImageCompanionSlotSpec = {
  slot: 'tae',
  role: 'tae',
  label: 'TAE / TAESD (alternative tiny VAE)',
  flag: '--taesd',
  matchPattern: 'taesd|taef1|taeqi2|taew2',
  optional: true
}

const CLIP_L_SLOT: ImageCompanionSlotSpec = {
  slot: 'clipL',
  role: 'clipL',
  label: 'CLIP-L encoder',
  flag: '--clip_l',
  matchPattern: 'clip[-_]?l'
}

const CLIP_G_SLOT: ImageCompanionSlotSpec = {
  slot: 'clipG',
  role: 'clipG',
  label: 'CLIP-G encoder',
  flag: '--clip_g',
  matchPattern: 'clip[-_]?g'
}

const T5XXL_SLOT: ImageCompanionSlotSpec = {
  slot: 't5xxl',
  role: 't5xxl',
  label: 'T5-XXL encoder',
  flag: '--t5xxl',
  matchPattern: 't5[-_]?xxl'
}

const QWEN3_4B_SLOT: ImageCompanionSlotSpec = {
  slot: 'llm',
  role: 'llm',
  label: 'Qwen3-4B text encoder',
  flag: '--llm',
  matchPattern: 'qwen[-_]?3[-_]?4b|qwen3-4b'
}

const QWEN3_8B_SLOT: ImageCompanionSlotSpec = {
  slot: 'llm',
  role: 'llm',
  label: 'Qwen3-8B text encoder',
  flag: '--llm',
  matchPattern: 'qwen[-_]?3[-_]?8b|qwen3-8b'
}

const MISTRAL_32_SLOT: ImageCompanionSlotSpec = {
  slot: 'llm',
  role: 'llm',
  label: 'Mistral Small 3.2 24B text encoder',
  flag: '--llm',
  matchPattern: 'mistral[-_ ]?small[-_ ]?3\\.?2|mistral3'
}

const QWEN25_VL_7B_SLOT: ImageCompanionSlotSpec = {
  slot: 'llm',
  role: 'llm',
  label: 'Qwen2.5-VL 7B encoder',
  flag: '--llm',
  matchPattern: 'qwen[-_]?2\\.?5[-_]?vl[-_]?7b'
}

const QWEN25_VL_MMPROJ_SLOT: ImageCompanionSlotSpec = {
  slot: 'llmVision',
  role: 'llmVision',
  label: 'Qwen2.5-VL mmproj (required with GGUF text encoder for image edit)',
  flag: '--llm_vision',
  matchPattern: 'qwen2\\.?5[-_]?vl.*mmproj|mmproj.*qwen2\\.?5',
  optional: true
}

const QWEN3_VL_8B_SLOT: ImageCompanionSlotSpec = {
  slot: 'llm',
  role: 'llm',
  label: 'Qwen3-VL 8B Instruct encoder',
  flag: '--llm',
  matchPattern: 'qwen[-_]?3[-_]?vl[-_]?8b|qwen3vl[-_]?8b'
}

const QWEN3_VL_MMPROJ_SLOT: ImageCompanionSlotSpec = {
  slot: 'llmVision',
  role: 'llmVision',
  label: 'Qwen3-VL mmproj (required with GGUF text encoder for image edit)',
  flag: '--llm_vision',
  matchPattern: 'mmproj.*qwen3[-_]?vl|qwen3[-_]?vl.*mmproj',
  optional: true
}

const IMAGE_ARCH_SPECS: Record<string, ImageArchSpec> = {
  'flux1-schnell': {
    id: 'flux1-schnell',
    label: 'FLUX.1 schnell',
    modular: true,
    vaeOrTae: true,
    defaults: { mode: 'diffusion', width: 1024, height: 1024, steps: 4, cfgScale: 1, sampler: 'euler' },
    slots: [CLIP_L_SLOT, T5XXL_SLOT, VAE_FLUX1, TAE_OPTIONAL]
  },
  flux: {
    id: 'flux1-dev',
    label: 'FLUX.1',
    modular: true,
    vaeOrTae: true,
    defaults: { mode: 'diffusion', width: 1024, height: 1024, steps: 20, cfgScale: 1, sampler: 'euler' },
    slots: [CLIP_L_SLOT, T5XXL_SLOT, VAE_FLUX1, TAE_OPTIONAL]
  },
  'flux2-klein-4b': {
    id: 'flux2-klein-4b',
    label: 'FLUX.2 Klein 4B',
    modular: true,
    vaeOrTae: true,
    defaults: { mode: 'diffusion', width: 1024, height: 1024, steps: 4, cfgScale: 1, sampler: 'euler' },
    slots: [QWEN3_4B_SLOT, VAE_FLUX2, TAE_OPTIONAL]
  },
  'flux2-klein-9b': {
    id: 'flux2-klein-9b',
    label: 'FLUX.2 Klein 9B',
    modular: true,
    vaeOrTae: true,
    defaults: { mode: 'diffusion', width: 1024, height: 1024, steps: 4, cfgScale: 1, sampler: 'euler' },
    slots: [QWEN3_8B_SLOT, VAE_FLUX2, TAE_OPTIONAL]
  },
  flux2: {
    id: 'flux2-dev',
    label: 'FLUX.2 dev',
    modular: true,
    vaeOrTae: true,
    defaults: { mode: 'diffusion', width: 1024, height: 1024, steps: 20, cfgScale: 1, sampler: 'euler' },
    slots: [MISTRAL_32_SLOT, VAE_FLUX2, TAE_OPTIONAL]
  },
  z_image: {
    id: 'z-image-turbo',
    label: 'Z-Image Turbo',
    modular: true,
    vaeOrTae: true,
    defaults: { mode: 'diffusion', width: 1024, height: 1024, steps: 9, cfgScale: 1, sampler: 'euler' },
    slots: [QWEN3_4B_SLOT, VAE_FLUX1, TAE_OPTIONAL]
  },
  qwen_image_21: {
    id: 'qwen-image-21',
    label: 'Qwen Image 2.1',
    modular: true,
    vaeOrTae: true,
    defaults: { mode: 'diffusion', width: 1024, height: 1024, steps: 20, cfgScale: 1, sampler: 'euler' },
    slots: [QWEN3_VL_8B_SLOT, QWEN3_VL_MMPROJ_SLOT, VAE_QWEN_21, TAE_OPTIONAL]
  },
  qwen_image: {
    id: 'qwen-image',
    label: 'Qwen Image',
    modular: true,
    vaeOrTae: true,
    defaults: { mode: 'diffusion', width: 1024, height: 1024, steps: 20, cfgScale: 2.5, sampler: 'euler' },
    slots: [QWEN25_VL_7B_SLOT, QWEN25_VL_MMPROJ_SLOT, VAE_QWEN_IMAGE, TAE_OPTIONAL]
  },
  sd3: {
    id: 'sd35-large',
    label: 'Stable Diffusion 3.5',
    modular: false,
    vaeOrTae: true,
    defaults: { mode: 'model', width: 1024, height: 1024, steps: 20, cfgScale: 4, sampler: 'euler' },
    slots: [
      { ...CLIP_L_SLOT, optional: true },
      { ...CLIP_G_SLOT, optional: true },
      { ...T5XXL_SLOT, optional: true }
    ]
  },
  chroma: {
    id: 'chroma',
    label: 'Chroma',
    modular: true,
    vaeOrTae: true,
    defaults: { mode: 'diffusion', width: 1024, height: 1024, steps: 20, cfgScale: 3, sampler: 'euler' },
    slots: [T5XXL_SLOT, VAE_FLUX1, TAE_OPTIONAL]
  },
  sdxl: {
    id: 'sdxl-checkpoint',
    label: 'Stable Diffusion XL',
    modular: false,
    defaults: { mode: 'model', width: 1024, height: 1024, steps: 20, cfgScale: 5, sampler: 'euler' },
    slots: []
  }
}

/** Match a weight architecture or filename to its upstream stable-diffusion.cpp recipe spec. */
export function resolveImageArchSpec(architecture?: string | null, name?: string | null): ImageArchSpec | null {
  const hay = `${architecture ?? ''} ${name ?? ''}`.toLowerCase()
  if (!hay.trim()) return null
  if (/klein[-_ ]?4b/.test(hay)) return IMAGE_ARCH_SPECS['flux2-klein-4b']
  if (/klein[-_ ]?9b/.test(hay)) return IMAGE_ARCH_SPECS['flux2-klein-9b']
  if (/flux[-_. ]?2|flux2/.test(hay)) return IMAGE_ARCH_SPECS.flux2
  if (/flux.*schnell/.test(hay)) return IMAGE_ARCH_SPECS['flux1-schnell']
  if (/flux/.test(hay)) return IMAGE_ARCH_SPECS.flux
  if (/z[-_. ]?image/.test(hay)) return IMAGE_ARCH_SPECS.z_image
  if (/qwen[-_. ]?image[-_. ]?2[._]?1|qwen_image_21/.test(hay)) return IMAGE_ARCH_SPECS.qwen_image_21
  if (/qwen[-_. ]?image/.test(hay)) return IMAGE_ARCH_SPECS.qwen_image
  if (/chroma/.test(hay)) return IMAGE_ARCH_SPECS.chroma
  if (/sd3|stable[-_ ]diffusion[-_ ]3/.test(hay)) return IMAGE_ARCH_SPECS.sd3
  if (/sdxl|xl[-_ ]base|pony|illustrious/.test(hay)) return IMAGE_ARCH_SPECS.sdxl
  return null
}

/** Check whether a recipe spec has its required companion slots satisfied. */
export function missingRecipeSlots(spec: ImageArchSpec, configured: Record<CompanionSlot, string | null>): ImageCompanionSlotSpec[] {
  const missing: ImageCompanionSlotSpec[] = []
  const hasDecode = Boolean(configured.vae || configured.tae)
  for (const s of spec.slots) {
    if (s.slot === 'tae' && spec.vaeOrTae) continue
    if (s.slot === 'vae' && spec.vaeOrTae) {
      if (!hasDecode) missing.push(s)
      continue
    }
    if (!s.optional && !configured[s.slot]) missing.push(s)
  }
  return missing
}

export interface VerifiedPackFile {
  role: CompanionRole
  label: string
  flag: string
  repo: string
  file: string
  sizeBytes: number
  targetRel: string
}

export interface VerifiedPackVariant {
  id: string
  label: string
  vramHint: string
  files: VerifiedPackFile[]
}

export interface VerifiedImagePack {
  id: string
  name: string
  category: 'Fast & Low VRAM' | 'High Quality' | 'Image Editing' | 'Classic Checkpoints'
  tagline: string
  recipeId: string
  defaults: ImageRecipeDefaults
  variants: VerifiedPackVariant[]
}

const basename = (p: string): string => p.split('/').pop() ?? p

const packFile = (role: CompanionRole, label: string, flag: string, repo: string, file: string, sizeBytes: number): VerifiedPackFile => {
  const dirByRole: Record<CompanionRole, string> = {
    model: 'diffusion_models',
    vae: 'vae',
    tae: 'vae',
    clipL: 'text_encoders',
    clipG: 'text_encoders',
    t5xxl: 'text_encoders',
    llm: 'text_encoders',
    llmVision: 'text_encoders',
    lora: 'loras',
    other: 'diffusion_models'
  }
  const dir = role === 'model' && flag === '--model' ? 'checkpoints' : dirByRole[role]
  return { role, label, flag, repo, file, sizeBytes, targetRel: `${dir}/${basename(file)}` }
}

const AE_VAE = packFile('vae', 'FLUX VAE (ae.safetensors)', '--vae', 'Comfy-Org/z_image_turbo', 'split_files/vae/ae.safetensors', 335304388)
const FLUX1_CLIP_L = packFile('clipL', 'CLIP-L encoder', '--clip_l', 'comfyanonymous/flux_text_encoders', 'clip_l.safetensors', 246144152)
const FLUX1_T5_FP8 = packFile('t5xxl', 'T5-XXL FP8 encoder', '--t5xxl', 'comfyanonymous/flux_text_encoders', 't5xxl_fp8_e4m3fn.safetensors', 4893934904)
const FLUX1_T5_FP16 = packFile('t5xxl', 'T5-XXL FP16 encoder', '--t5xxl', 'comfyanonymous/flux_text_encoders', 't5xxl_fp16.safetensors', 9787841024)
const FLUX2_VAE = packFile('vae', 'FLUX.2 VAE (flux2-vae.safetensors)', '--vae', 'Comfy-Org/Flux-2-Klein-4B', 'split_files/vae/flux2-vae.safetensors', 336211292)
const QWEN3_4B_Q4 = packFile('llm', 'Qwen3-4B Q4_K_M encoder', '--llm', 'Qwen/Qwen3-4B-GGUF', 'Qwen3-4B-Q4_K_M.gguf', 2497280256)
const QWEN3_4B_Q8 = packFile('llm', 'Qwen3-4B Q8_0 encoder', '--llm', 'Qwen/Qwen3-4B-GGUF', 'Qwen3-4B-Q8_0.gguf', 4280404704)

/**
 * Curated `sd-server` packs matching upstream `leejet/stable-diffusion.cpp` docs & recipes.
 * Every repo, path, and byte size below was HTTP-HEAD verified directly against Hugging Face.
 */
export const VERIFIED_IMAGE_PACKS: VerifiedImagePack[] = [
  {
    id: 'z-image-turbo',
    name: 'Z-Image Turbo',
    category: 'Fast & Low VRAM',
    tagline: 'Fast 9-step distilled photoreal DiT model. Recommended starter for 8–12 GB GPUs.',
    recipeId: 'z-image-turbo',
    defaults: { mode: 'diffusion', width: 1024, height: 1024, steps: 9, cfgScale: 1, sampler: 'euler' },
    variants: [
      {
        id: 'q4_k',
        label: 'Compact Q4_K GGUF (6.7 GB total)',
        vramHint: '8 GB+ VRAM (use 512px + CPU offload if tight)',
        files: [
          packFile('model', 'Diffusion model (Q4_K)', '--diffusion-model', 'leejet/Z-Image-Turbo-GGUF', 'z_image_turbo-Q4_K.gguf', 3864250304),
          QWEN3_4B_Q4,
          AE_VAE
        ]
      },
      {
        id: 'q8_0',
        label: 'High Quality Q8_0 (11.2 GB total)',
        vramHint: '12 GB+ VRAM',
        files: [
          packFile('model', 'Diffusion model (Q8_0)', '--diffusion-model', 'leejet/Z-Image-Turbo-GGUF', 'z_image_turbo-Q8_0.gguf', 6577440704),
          QWEN3_4B_Q8,
          AE_VAE
        ]
      }
    ]
  },
  {
    id: 'flux2-klein-4b',
    name: 'FLUX.2 Klein 4B',
    category: 'Fast & Low VRAM',
    tagline: 'Smallest FLUX.2 model (4 steps). Lowest VRAM modular DiT with Qwen3-4B.',
    recipeId: 'flux2-klein-4b',
    defaults: { mode: 'diffusion', width: 1024, height: 1024, steps: 4, cfgScale: 1, sampler: 'euler' },
    variants: [
      {
        id: 'q4_0',
        label: 'Compact Q4_0 GGUF (5.3 GB total)',
        vramHint: '6–8 GB+ VRAM',
        files: [
          packFile('model', 'Diffusion model (Q4_0)', '--diffusion-model', 'leejet/FLUX.2-klein-4B-GGUF', 'flux-2-klein-4b-Q4_0.gguf', 2460378560),
          QWEN3_4B_Q4,
          FLUX2_VAE
        ]
      },
      {
        id: 'q8_0',
        label: 'High Quality Q8_0 (8.9 GB total)',
        vramHint: '10–12 GB+ VRAM',
        files: [
          packFile('model', 'Diffusion model (Q8_0)', '--diffusion-model', 'leejet/FLUX.2-klein-4B-GGUF', 'flux-2-klein-4b-Q8_0.gguf', 4300629440),
          QWEN3_4B_Q8,
          FLUX2_VAE
        ]
      }
    ]
  },
  {
    id: 'flux1-schnell',
    name: 'FLUX.1 schnell',
    category: 'Fast & Low VRAM',
    tagline: '4-step Apache-2.0 FLUX.1 model with public CLIP-L, T5-XXL, and AE VAE.',
    recipeId: 'flux1-schnell',
    defaults: { mode: 'diffusion', width: 1024, height: 1024, steps: 4, cfgScale: 1, sampler: 'euler' },
    variants: [
      {
        id: 'q4_k',
        label: 'Q4_K GGUF + T5 FP8 (12.4 GB total)',
        vramHint: '8–12 GB VRAM (with CPU offload)',
        files: [
          packFile('model', 'Diffusion model (Q4_K)', '--diffusion-model', 'leejet/FLUX.1-schnell-gguf', 'flux1-schnell-q4_k.gguf', 6884606880),
          FLUX1_CLIP_L,
          FLUX1_T5_FP8,
          AE_VAE
        ]
      },
      {
        id: 'q8_0',
        label: 'Q8_0 GGUF + T5 FP16 (23.2 GB total)',
        vramHint: '16–24 GB VRAM',
        files: [
          packFile('model', 'Diffusion model (Q8_0)', '--diffusion-model', 'leejet/FLUX.1-schnell-gguf', 'flux1-schnell-q8_0.gguf', 12801721248),
          FLUX1_CLIP_L,
          FLUX1_T5_FP16,
          AE_VAE
        ]
      }
    ]
  },
  {
    id: 'flux2-klein-9b',
    name: 'FLUX.2 Klein 9B',
    category: 'High Quality',
    tagline: 'Larger 9B FLUX.2 model with Qwen3-8B encoder (4 steps).',
    recipeId: 'flux2-klein-9b',
    defaults: { mode: 'diffusion', width: 1024, height: 1024, steps: 4, cfgScale: 1, sampler: 'euler' },
    variants: [
      {
        id: 'q4_0',
        label: 'Q4_0 GGUF + Qwen3-8B Q4_K_M (11.0 GB total)',
        vramHint: '10–16 GB VRAM',
        files: [
          packFile('model', 'Diffusion model (Q4_0)', '--diffusion-model', 'leejet/FLUX.2-klein-9B-GGUF', 'flux-2-klein-9b-Q4_0.gguf', 5616208032),
          packFile('llm', 'Qwen3-8B Q4_K_M encoder', '--llm', 'Qwen/Qwen3-8B-GGUF', 'Qwen3-8B-Q4_K_M.gguf', 5027783488),
          FLUX2_VAE
        ]
      }
    ]
  },
  {
    id: 'flux1-dev',
    name: 'FLUX.1 dev',
    category: 'High Quality',
    tagline: '20-step flagship FLUX.1 model. Shares CLIP-L / T5-XXL / ae VAE with FLUX.1 schnell.',
    recipeId: 'flux1-dev',
    defaults: { mode: 'diffusion', width: 1024, height: 1024, steps: 20, cfgScale: 1, sampler: 'euler' },
    variants: [
      {
        id: 'q4_k',
        label: 'Q4_K GGUF + T5 FP8 (12.4 GB total)',
        vramHint: '8–12 GB VRAM (with CPU offload)',
        files: [
          packFile('model', 'Diffusion model (Q4_K)', '--diffusion-model', 'leejet/FLUX.1-dev-gguf', 'flux1-dev-q4_k.gguf', 6925526176),
          FLUX1_CLIP_L,
          FLUX1_T5_FP8,
          AE_VAE
        ]
      }
    ]
  },
  {
    id: 'qwen-image-21',
    name: 'Qwen Image 2.1',
    category: 'Image Editing',
    tagline: 'Text-to-image + native reference editing using Qwen3-VL 8B + vision mmproj + 2.1 VAE.',
    recipeId: 'qwen-image-21',
    defaults: { mode: 'diffusion', width: 1024, height: 1024, steps: 20, cfgScale: 1, sampler: 'euler' },
    variants: [
      {
        id: 'q4_k',
        label: 'Q4_K GGUF + Qwen3-VL + mmproj (11.1 GB total)',
        vramHint: '10–16 GB VRAM',
        files: [
          packFile('model', 'Diffusion model (Q4_K)', '--diffusion-model', 'leejet/Qwen-Image-2.1-GGUF', 'qwen_image_2.1-Q4_K.gguf', 4197494816),
          packFile('llm', 'Qwen3-VL 8B Q4_K_M', '--llm', 'Qwen/Qwen3-VL-8B-Instruct-GGUF', 'Qwen3VL-8B-Instruct-Q4_K_M.gguf', 5027784800),
          packFile('llmVision', 'Qwen3-VL mmproj (F16)', '--llm_vision', 'Qwen/Qwen3-VL-8B-Instruct-GGUF', 'mmproj-Qwen3VL-8B-Instruct-F16.gguf', 1159029824),
          packFile('vae', 'Qwen Image 2.1 VAE', '--vae', 'Comfy-Org/Qwen-Image-2.1', 'vae/qwen_image_2.1_vae_bf16.safetensors', 675509688)
        ]
      }
    ]
  },
  {
    id: 'flux1-kontext',
    name: 'FLUX.1 Kontext dev',
    category: 'Image Editing',
    tagline: 'Text-to-image & native instruction-based image editing. Shares FLUX.1 companions.',
    recipeId: 'flux1-kontext',
    defaults: { mode: 'diffusion', width: 1024, height: 1024, steps: 20, cfgScale: 1, sampler: 'euler' },
    variants: [
      {
        id: 'q4_k_m',
        label: 'Q4_K_M GGUF + T5 FP8 (12.4 GB total)',
        vramHint: '8–12 GB VRAM (with CPU offload)',
        files: [
          packFile('model', 'Diffusion model (Q4_K_M)', '--diffusion-model', 'QuantStack/FLUX.1-Kontext-dev-GGUF', 'flux1-kontext-dev-Q4_K_M.gguf', 6931817760),
          FLUX1_CLIP_L,
          FLUX1_T5_FP8,
          AE_VAE
        ]
      }
    ]
  },
  {
    id: 'sdxl-checkpoint',
    name: 'Stable Diffusion XL 1.0',
    category: 'Classic Checkpoints',
    tagline: 'Monolithic 1-file SDXL checkpoint + FP16-fix VAE (no separate encoders needed).',
    recipeId: 'sdxl-checkpoint',
    defaults: { mode: 'model', width: 1024, height: 1024, steps: 20, cfgScale: 5, sampler: 'euler' },
    variants: [
      {
        id: 'base-fp16fix',
        label: 'SDXL 1.0 Base + FP16 VAE (7.3 GB total)',
        vramHint: '8 GB+ VRAM',
        files: [
          packFile('model', 'SDXL 1.0 Base Checkpoint', '--model', 'stabilityai/stable-diffusion-xl-base-1.0', 'sd_xl_base_1.0.safetensors', 6938078334),
          packFile('vae', 'SDXL FP16-fix VAE', '--vae', 'madebyollin/sdxl-vae-fp16-fix', 'sdxl_vae.safetensors', 334641162)
        ]
      }
    ]
  },
  {
    id: 'sd-turbo',
    name: 'SD Turbo',
    category: 'Classic Checkpoints',
    tagline: 'Single-file 512px distilled SD 2.1 checkpoint (1–4 steps). Runs fast on 4–6 GB GPUs.',
    recipeId: 'sd-turbo',
    defaults: { mode: 'model', width: 512, height: 512, steps: 4, cfgScale: 1, sampler: 'euler_a' },
    variants: [
      {
        id: 'single',
        label: 'Single Checkpoint (5.2 GB)',
        vramHint: '4–6 GB+ VRAM',
        files: [packFile('model', 'SD Turbo Checkpoint', '--model', 'stabilityai/sd-turbo', 'sd_turbo.safetensors', 5214561328)]
      }
    ]
  },
  {
    id: 'sd35-large-fp8',
    name: 'Stable Diffusion 3.5 Large FP8',
    category: 'High Quality',
    tagline: 'SD 3.5 Large (ungated FP8 scaled weights) with CLIP-L, CLIP-G, and T5-XXL FP8.',
    recipeId: 'sd35-large-fp8',
    defaults: { mode: 'model', width: 1024, height: 1024, steps: 20, cfgScale: 4, sampler: 'euler' },
    variants: [
      {
        id: 'fp8',
        label: 'FP8 Scaled + CLIP-L/G + T5 FP8 (21.5 GB total)',
        vramHint: '16 GB+ VRAM',
        files: [
          packFile('model', 'SD 3.5 Large FP8 checkpoint', '--model', 'Comfy-Org/stable-diffusion-3.5-fp8', 'sd3.5_large_fp8_scaled.safetensors', 14934922866),
          packFile('clipL', 'CLIP-L encoder', '--clip_l', 'Comfy-Org/stable-diffusion-3.5-fp8', 'text_encoders/clip_l.safetensors', 246144152),
          packFile('clipG', 'CLIP-G encoder', '--clip_g', 'Comfy-Org/stable-diffusion-3.5-fp8', 'text_encoders/clip_g.safetensors', 1389382176),
          packFile('t5xxl', 'T5-XXL FP8 encoder', '--t5xxl', 'Comfy-Org/stable-diffusion-3.5-fp8', 'text_encoders/t5xxl_fp8_e4m3fn.safetensors', 4893934904)
        ]
      }
    ]
  }
]
