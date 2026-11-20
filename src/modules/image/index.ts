import { linkFor } from '@shared/text'
import { IMAGE_SAMPLER_NAMES } from '@shared/imageModels'
import { isImageModel } from '@shared/remoteModels'
import { isVaultLocked } from '@shared/sealed'
import type { ModuleFactory } from '../../engine/modules/sdk'
import { getImageRuntime } from '../../engine/image/runtime'
import { resolveFile } from '../../engine/library/files'
import type { JsonObjectSchema, JsonSchema } from '../../engine/tools/schema'
import { ToolError, optInt, optStr, str, type ToolDef } from '../../engine/tools/types'
import { secure } from '../../engine/util/secure'

function availableModels(): { id: string; name: string }[] {
  if (secure.enabled && !secure.unlocked) return []
  const rt = getImageRuntime()
  if (!rt) return []
  try {
    return rt.models
      .list()
      .filter((m) => isImageModel(m))
      .map((m) => ({ id: m.id, name: m.name }))
  } catch (err) {
    if (isVaultLocked(err)) return []
    throw err
  }
}

function modelParamSchema(models: { id: string; name: string }[]): JsonSchema {
  if (models.length === 0) {
    return {
      type: 'string',
      description: 'Image model name or id (optional; none are configured in Models yet)'
    }
  }
  const names = [...new Set(models.map((m) => m.name))]
  return {
    type: 'string',
    enum: names,
    description: 'Which configured image model to use (optional when only one image model exists)'
  }
}

function resolveModelId(requested: string | null): string | undefined {
  const models = availableModels()
  if (models.length === 0) {
    throw new ToolError('No image model is configured. Add a diffusion checkpoint (.safetensors / .ckpt / .gguf) or remote image model in Models first.')
  }
  if (!requested) {
    if (models.length === 1) return models[0].id
    return undefined
  }
  const q = requested.trim()
  const lower = q.toLowerCase()
  const exact = models.find((m) => m.id === q || m.name.toLowerCase() === lower)
  if (exact) return exact.id
  throw new ToolError(`There is no image model called "${q}". Available image models: ${models.map((m) => m.name).join(', ')}.`)
}

function withModelParam(base: JsonObjectSchema): JsonObjectSchema {
  return {
    ...base,
    properties: {
      ...base.properties,
      model: modelParamSchema(availableModels())
    }
  }
}

async function runToolOp<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof ToolError) throw err
    throw new ToolError(err instanceof Error ? err.message : String(err))
  }
}

function optNum(params: Record<string, unknown>, key: string): number | null {
  const value = params[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const GENERATE_PARAMS: JsonObjectSchema = {
  type: 'object',
  properties: {
    prompt: { type: 'string', description: 'Detailed description of the image to generate' },
    negative_prompt: { type: 'string', description: 'Optional elements to avoid (local sd-server)' },
    width: { type: 'integer', minimum: 64, maximum: 4096, description: 'Image width in pixels (optional, defaults to model setting)' },
    height: { type: 'integer', minimum: 64, maximum: 4096, description: 'Image height in pixels (optional, defaults to model setting)' },
    steps: { type: 'integer', minimum: 1, maximum: 150, description: 'Sampling steps (optional, defaults to model setting)' },
    cfg_scale: { type: 'number', minimum: 0, maximum: 30, description: 'CFG guidance scale (optional, defaults to model setting)' },
    sampler: { type: 'string', enum: IMAGE_SAMPLER_NAMES, description: 'Sampling method (optional, defaults to model setting)' },
    model: { type: 'string', description: 'Image model name or id (optional)' },
    seed: { type: 'integer', description: 'Optional random seed for reproducible output' },
    name: { type: 'string', description: 'Optional short filename for the saved library asset' }
  },
  required: ['prompt']
}

const EDIT_PARAMS: JsonObjectSchema = {
  type: 'object',
  properties: {
    image: { type: 'string', description: 'Source library image (@file:<id>, file id, or filename)' },
    prompt: { type: 'string', description: 'Instructions describing how to edit or transform the image' },
    negative_prompt: { type: 'string', description: 'Optional elements to avoid (local sd-server)' },
    mask: { type: 'string', description: 'Optional mask image (@file:<id>, file id, or filename) for inpainting' },
    width: { type: 'integer', minimum: 64, maximum: 4096, description: 'Output width in pixels (optional)' },
    height: { type: 'integer', minimum: 64, maximum: 4096, description: 'Output height in pixels (optional)' },
    steps: { type: 'integer', minimum: 1, maximum: 150, description: 'Sampling steps (optional, defaults to model setting)' },
    cfg_scale: { type: 'number', minimum: 0, maximum: 30, description: 'CFG guidance scale (optional, defaults to model setting)' },
    sampler: { type: 'string', enum: IMAGE_SAMPLER_NAMES, description: 'Sampling method (optional, defaults to model setting)' },
    model: { type: 'string', description: 'Image model name or id (optional)' },
    seed: { type: 'integer', description: 'Optional random seed' },
    name: { type: 'string', description: 'Optional short filename for the edited library asset' }
  },
  required: ['image', 'prompt']
}

const generateImageTool: ToolDef = {
  name: 'generate_image',
  group: 'image',
  needsWorkspace: false,
  maxRepeats: 3,
  description: 'Generate a new image with local sd-server or a remote image model and save it into Seven as an @file link.',
  params: GENERATE_PARAMS,
  forAgent: () => ({ params: withModelParam(GENERATE_PARAMS) }),
  activity: () => 'Generating image',
  async execute(params, ctx) {
    const rt = getImageRuntime()
    if (!rt) throw new ToolError('Image generation runtime is not started.')
    const prompt = str(params, 'prompt')
    const modelId = resolveModelId(optStr(params, 'model'))
    const negativePrompt = optStr(params, 'negative_prompt') ?? undefined
    const width = optInt(params, 'width') ?? undefined
    const height = optInt(params, 'height') ?? undefined
    const steps = optInt(params, 'steps') ?? undefined
    const cfgScale = optNum(params, 'cfg_scale') ?? undefined
    const sampler = optStr(params, 'sampler') ?? undefined
    const seed = optInt(params, 'seed') ?? undefined
    const name = optStr(params, 'name') ?? undefined

    const res = await runToolOp(() =>
      rt.host.generate(
        {
          modelId,
          prompt,
          negativePrompt,
          width,
          height,
          steps,
          cfgScale,
          sampler,
          seed,
          name,
          originTool: 'generate_image',
          sessionId: ctx.sessionId
        },
        { signal: ctx.signal, forceRestoreChat: true }
      )
    )
    const link = linkFor('file', res.asset.id)
    return {
      text: `Generated image ${link} (${res.width}x${res.height}${res.seed !== null ? `, seed ${res.seed}` : ''}). Reference ${link} to display or attach it.`,
      images: [res.asset.id]
    }
  }
}

const editImageTool: ToolDef = {
  name: 'edit_image',
  group: 'image',
  needsWorkspace: false,
  maxRepeats: 3,
  description: 'Edit or transform an existing library picture using local sd-server or a remote image model, saving the result as a new @file link.',
  params: EDIT_PARAMS,
  forAgent: () => ({ params: withModelParam(EDIT_PARAMS) }),
  activity: () => 'Editing image',
  async execute(params, ctx) {
    const rt = getImageRuntime()
    if (!rt) throw new ToolError('Image generation runtime is not started.')
    const source = resolveFile(str(params, 'image'), ['image'], 'an image file')
    const maskRef = optStr(params, 'mask')
    const mask = maskRef ? resolveFile(maskRef, ['image'], 'a mask image file') : null
    const prompt = str(params, 'prompt')
    const modelId = resolveModelId(optStr(params, 'model'))
    const negativePrompt = optStr(params, 'negative_prompt') ?? undefined
    const width = optInt(params, 'width') ?? undefined
    const height = optInt(params, 'height') ?? undefined
    const steps = optInt(params, 'steps') ?? undefined
    const cfgScale = optNum(params, 'cfg_scale') ?? undefined
    const sampler = optStr(params, 'sampler') ?? undefined
    const seed = optInt(params, 'seed') ?? undefined
    const name = optStr(params, 'name') ?? undefined

    const res = await runToolOp(() =>
      rt.host.edit(
        {
          modelId,
          sourceAssetId: source.id,
          maskAssetId: mask?.id,
          prompt,
          negativePrompt,
          width,
          height,
          steps,
          cfgScale,
          sampler,
          seed,
          name,
          originTool: 'edit_image',
          sessionId: ctx.sessionId
        },
        { signal: ctx.signal, forceRestoreChat: true }
      )
    )
    const link = linkFor('file', res.asset.id)
    return {
      text: `Edited image ${link} (${res.width}x${res.height}${res.seed !== null ? `, seed ${res.seed}` : ''}). Reference ${link} to display or attach it.`,
      images: [res.asset.id]
    }
  }
}

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(tools: { add(tool: ToolDef): void }): void {
      tools.add(generateImageTool)
      tools.add(editImageTool)
    }
  }

export default factory
