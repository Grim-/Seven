import type { ImageProgress, RemoteApi, RemoteSpec } from '@shared/types'
import { normalizeGoogleBase, remoteApiMeta } from '@shared/remoteModels'
import { data } from '../data/hub'
import { waitWithAbort } from '../model/server/net'
import { noteFailure } from '../util/report'

export interface ResolvedImageParams {
  prompt: string
  negativePrompt?: string
  width: number
  height: number
  steps: number
  cfgScale: number
  seed?: number
  sampler?: string
  sourceAssetId?: string
  maskAssetId?: string
}

export interface ImageOutputPayload {
  bytes: Buffer
  mime: string
  seed: number | null
  width: number
  height: number
}

export type ImageTarget =
  | { kind: 'sd-server'; baseUrl: string; modelName: string }
  | { kind: 'remote'; spec: RemoteSpec; key: string | null }

interface SourceAssetBytes {
  bytes: Buffer
  mime: string
  filename: string
}

type BackendHandler = (
  target: ImageTarget,
  req: ResolvedImageParams,
  signal: AbortSignal,
  onProgress?: (progress: ImageProgress) => void
) => Promise<ImageOutputPayload>

function readAssetImage(assetId: string, role: string): SourceAssetBytes {
  const meta = data.assets.get(assetId)
  if (meta.kind !== 'image') throw new Error(`${role} asset "${meta.name}" is not an image.`)
  return { bytes: data.assets.readBytes(meta), mime: meta.mime || 'image/png', filename: meta.name }
}

/** Parse PNG or JPEG dimensions cleanly so Asset dimensions match the actual output bytes. */
export function imageDimensions(bytes: Buffer, fallbackWidth: number, fallbackHeight: number): { width: number; height: number } {
  // PNG signature + IHDR chunk
  if (bytes.length >= 24 && bytes.readUInt32BE(0) === 0x89504e47 && bytes.toString('ascii', 12, 16) === 'IHDR') {
    const w = bytes.readUInt32BE(16)
    const h = bytes.readUInt32BE(20)
    if (w > 0 && h > 0) return { width: w, height: h }
  }
  // JPEG SOF0/SOF2
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) break
      const marker = bytes[i + 1]
      const len = bytes.readUInt16BE(i + 2)
      if ((marker === 0xc0 || marker === 0xc2) && i + 8 < bytes.length) {
        const h = bytes.readUInt16BE(i + 5)
        const w = bytes.readUInt16BE(i + 7)
        if (w > 0 && h > 0) return { width: w, height: h }
      }
      if (len < 2) break
      i += 2 + len
    }
  }
  return { width: fallbackWidth, height: fallbackHeight }
}

async function parseError(res: Response, what: string): Promise<Error> {
  const raw = await res.text().catch(() => '')
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } | string }
    const msg = typeof parsed.error === 'string' ? parsed.error : parsed.error?.message
    if (msg) return new Error(`${what} failed (${res.status}): ${msg}`)
  } catch {
    // Plain-text error body
  }
  return new Error(`${what} failed (${res.status}${raw ? `: ${raw.slice(0, 300)}` : ''}).`)
}

async function extractOpenAiImage(json: unknown, fallbackWidth: number, fallbackHeight: number, signal: AbortSignal): Promise<ImageOutputPayload> {
  const rec = (json && typeof json === 'object' ? json : {}) as { data?: { b64_json?: string; url?: string; seed?: number }[]; images?: string[] }
  const first = rec.data?.[0]
  if (first?.b64_json) {
    const bytes = Buffer.from(first.b64_json, 'base64')
    const dims = imageDimensions(bytes, fallbackWidth, fallbackHeight)
    return { bytes, mime: 'image/png', seed: typeof first.seed === 'number' ? first.seed : null, ...dims }
  }
  if (first?.url) {
    const fetched = await fetch(first.url, { signal })
    if (!fetched.ok) throw new Error(`Could not download generated image (${fetched.status}).`)
    const bytes = Buffer.from(await fetched.arrayBuffer())
    const dims = imageDimensions(bytes, fallbackWidth, fallbackHeight)
    return { bytes, mime: fetched.headers.get('content-type') || 'image/png', seed: typeof first.seed === 'number' ? first.seed : null, ...dims }
  }
  const webui = rec.images?.[0]
  if (typeof webui === 'string' && webui) {
    const bytes = Buffer.from(webui.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    const dims = imageDimensions(bytes, fallbackWidth, fallbackHeight)
    return { bytes, mime: 'image/png', seed: null, ...dims }
  }
  throw new Error('The image server returned no image data.')
}

function buildSdCppExtraArgs(req: ResolvedImageParams): Record<string, unknown> {
  return {
    ...(req.negativePrompt ? { negative_prompt: req.negativePrompt } : {}),
    ...(req.seed !== undefined ? { seed: req.seed } : {}),
    sample_params: {
      sample_steps: req.steps,
      ...(req.sampler ? { sample_method: req.sampler } : {}),
      guidance: { txt_cfg: req.cfgScale }
    }
  }
}

function asDataUrl(asset: SourceAssetBytes): string {
  return `data:${asset.mime};base64,${asset.bytes.toString('base64')}`
}

async function runOpenAiLike(baseUrl: string, apiKey: string | null, model: string | undefined, withSdCpp: boolean, req: ResolvedImageParams, signal: AbortSignal): Promise<ImageOutputPayload> {
  const base = baseUrl.replace(/\/+$/, '')
  const size = `${req.width}x${req.height}`
  const headers: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
  const what = withSdCpp ? 'sd-server' : 'Image API'
  const promptText = withSdCpp ? `${req.prompt} <sd_cpp_extra_args>${JSON.stringify(buildSdCppExtraArgs(req))}</sd_cpp_extra_args>` : req.prompt

  if (req.sourceAssetId) {
    const source = readAssetImage(req.sourceAssetId, 'Source')
    const form = new FormData()
    form.append('image', new Blob([new Uint8Array(source.bytes)], { type: source.mime }), source.filename)
    if (req.maskAssetId) {
      const mask = readAssetImage(req.maskAssetId, 'Mask')
      form.append('mask', new Blob([new Uint8Array(mask.bytes)], { type: mask.mime }), mask.filename)
    }
    if (model && !withSdCpp) form.append('model', model)
    form.append('prompt', promptText)
    form.append('size', size)
    form.append('n', '1')
    if (withSdCpp) form.append('output_format', 'png')
    else form.append('response_format', 'b64_json')
    const res = await fetch(`${base}/images/edits`, { method: 'POST', headers, body: form, signal })
    if (!res.ok) throw await parseError(res, what)
    return extractOpenAiImage(await res.json(), req.width, req.height, signal)
  }

  const body: Record<string, unknown> = {
    ...(model && !withSdCpp ? { model } : {}),
    prompt: promptText,
    size,
    n: 1,
    ...(withSdCpp ? { output_format: 'png' } : { response_format: 'b64_json' })
  }
  const res = await fetch(`${base}/images/generations`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  })
  if (!res.ok) throw await parseError(res, what)
  return extractOpenAiImage(await res.json(), req.width, req.height, signal)
}

interface SdCppProgressPayload {
  stage?: string
  detail?: string
  completed?: number | null
  total?: number | null
  elapsed_ms?: number
}

interface SdCppJobResponse {
  id: string
  status?: string
  poll_url?: string
  progress?: SdCppProgressPayload
  result?: { images?: { b64_json?: string; generation_info?: { seed?: number } }[] } | null
  error?: { code?: string; message?: string } | null
}

async function runSdServer(
  baseUrl: string,
  modelName: string,
  req: ResolvedImageParams,
  signal: AbortSignal,
  onProgress?: (progress: ImageProgress) => void
): Promise<ImageOutputPayload> {
  const base = baseUrl.replace(/\/+$/, '')
  const body: Record<string, unknown> = {
    prompt: req.prompt,
    ...buildSdCppExtraArgs(req),
    width: req.width,
    height: req.height,
    batch_count: 1,
    output_format: 'png'
  }
  if (req.sourceAssetId) {
    const sourceUrl = asDataUrl(readAssetImage(req.sourceAssetId, 'Source'))
    if (req.maskAssetId) {
      body.init_image = sourceUrl
      body.mask_image = asDataUrl(readAssetImage(req.maskAssetId, 'Mask'))
    } else {
      body.ref_images = [sourceUrl]
    }
  }

  onProgress?.({ stage: 'submitting', detail: '', completed: null, total: null, elapsedMs: 0 })
  const submitRes = await fetch(`${base}/sdcpp/v1/img_gen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  })
  if (submitRes.status === 404) {
    onProgress?.({ stage: 'sampling', detail: '', completed: null, total: null, elapsedMs: 0 })
    return runOpenAiLike(`${base}/v1`, null, modelName, true, req, signal)
  }
  if (!submitRes.ok) throw await parseError(submitRes, 'sd-server')

  const created = (await submitRes.json()) as SdCppJobResponse
  const pollUrl = created.poll_url?.startsWith('http') ? created.poll_url : `${base}${created.poll_url || `/sdcpp/v1/jobs/${created.id}`}`
  const cancelJob = () => {
    void fetch(`${base}/sdcpp/v1/jobs/${encodeURIComponent(created.id)}/cancel`, {
      method: 'POST',
      signal: AbortSignal.timeout(3000)
    }).catch((err: unknown) => noteFailure(err, 'image', 'Could not cancel sd-server job'))
  }

  for (;;) {
    if (signal.aborted) {
      cancelJob()
      throw new Error('Image generation was cancelled')
    }
    try {
      await waitWithAbort(250, signal, 'Image generation was cancelled')
    } catch (err) {
      cancelJob()
      throw err
    }
    let pollRes: Response
    try {
      pollRes = await fetch(pollUrl, { signal })
    } catch (err) {
      if (signal.aborted) cancelJob()
      throw err
    }
    if (!pollRes.ok) throw await parseError(pollRes, 'sd-server')
    const job = (await pollRes.json()) as SdCppJobResponse
    if (job.progress?.stage) {
      onProgress?.({
        stage: job.progress.stage,
        detail: job.progress.detail ?? '',
        completed: typeof job.progress.completed === 'number' ? job.progress.completed : null,
        total: typeof job.progress.total === 'number' ? job.progress.total : null,
        elapsedMs: typeof job.progress.elapsed_ms === 'number' ? job.progress.elapsed_ms : 0
      })
    }
    if (job.status === 'completed') {
      const first = job.result?.images?.[0]
      if (!first?.b64_json) throw new Error('sd-server returned a completed job without image data.')
      const bytes = Buffer.from(first.b64_json, 'base64')
      const dims = imageDimensions(bytes, req.width, req.height)
      const seed = typeof first.generation_info?.seed === 'number' ? first.generation_info.seed : null
      return { bytes, mime: 'image/png', seed, ...dims }
    }
    if (job.status === 'failed') {
      throw new Error(job.error?.message || 'sd-server image generation failed.')
    }
    if (job.status === 'cancelled') {
      throw new Error(job.error?.message || 'Image generation was cancelled')
    }
  }
}

async function runGoogleImage(spec: RemoteSpec, key: string | null, req: ResolvedImageParams, signal: AbortSignal): Promise<ImageOutputPayload> {
  if (!key) throw new Error('Add a Google Gemini API key for this remote model first.')
  const base = normalizeGoogleBase(spec.baseUrl)
  const headers = { 'x-goog-api-key': key, 'Content-Type': 'application/json' }

  if (/^imagen-/i.test(spec.model) && !req.sourceAssetId) {
    const res = await fetch(`${base}/models/${encodeURIComponent(spec.model)}:predict`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ instances: [{ prompt: req.prompt }], parameters: { sampleCount: 1 } }),
      signal
    })
    if (!res.ok) throw await parseError(res, 'Google Imagen')
    const json = (await res.json()) as { predictions?: { bytesBase64Encoded?: string; mimeType?: string }[] }
    const pred = json.predictions?.[0]
    if (!pred?.bytesBase64Encoded) throw new Error('Google Imagen returned no image data.')
    const bytes = Buffer.from(pred.bytesBase64Encoded, 'base64')
    const dims = imageDimensions(bytes, req.width, req.height)
    return { bytes, mime: pred.mimeType || 'image/png', seed: null, ...dims }
  }

  const parts: Record<string, unknown>[] = []
  if (req.sourceAssetId) {
    const source = readAssetImage(req.sourceAssetId, 'Source')
    parts.push({ inlineData: { mimeType: source.mime, data: source.bytes.toString('base64') } })
  }
  if (req.maskAssetId) {
    const mask = readAssetImage(req.maskAssetId, 'Mask')
    parts.push({ inlineData: { mimeType: mask.mime, data: mask.bytes.toString('base64') } })
  }
  parts.push({ text: req.negativePrompt ? `${req.prompt}\n\nAvoid: ${req.negativePrompt}` : req.prompt })

  const res = await fetch(`${base}/models/${encodeURIComponent(spec.model)}:generateContent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
    }),
    signal
  })
  if (!res.ok) throw await parseError(res, 'Google Gemini image generation')
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } }[] } }[]
  }
  for (const part of json.candidates?.[0]?.content?.parts ?? []) {
    const inline = part.inlineData ?? (part.inline_data ? { data: part.inline_data.data, mimeType: part.inline_data.mime_type } : null)
    if (inline?.data) {
      const bytes = Buffer.from(inline.data, 'base64')
      const dims = imageDimensions(bytes, req.width, req.height)
      return { bytes, mime: inline.mimeType || 'image/png', seed: null, ...dims }
    }
  }
  throw new Error('Google Gemini returned no image part.')
}

const BACKENDS: Record<'sd-server' | RemoteApi, BackendHandler> = {
  'sd-server': (target, req, signal, onProgress) => {
    if (target.kind !== 'sd-server') throw new Error('Invalid local sd-server target')
    return runSdServer(target.baseUrl, target.modelName, req, signal, onProgress)
  },
  openai: (target, req, signal) => {
    if (target.kind !== 'remote') throw new Error('Invalid OpenAI image target')
    const baseUrl = target.spec.baseUrl?.trim() || remoteApiMeta('openai').defaultBaseUrl
    return runOpenAiLike(baseUrl, target.key, target.spec.model, false, req, signal)
  },
  google: (target, req, signal) => {
    if (target.kind !== 'remote') throw new Error('Invalid Google image target')
    return runGoogleImage(target.spec, target.key, req, signal)
  },
  anthropic: async () => {
    throw new Error('Anthropic Messages API does not support image generation. Pick a local diffusion model, OpenAI-compatible, or Google image model.')
  }
}

/** Dispatch image generation or editing against local sd-server or a configured remote image model. */
export function executeImageRequest(
  target: ImageTarget,
  req: ResolvedImageParams,
  signal: AbortSignal,
  onProgress?: (progress: ImageProgress) => void
): Promise<ImageOutputPayload> {
  const key = target.kind === 'sd-server' ? 'sd-server' : target.spec.api
  return BACKENDS[key](target, req, signal, onProgress)
}
