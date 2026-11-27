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
  loras?: { stem: string; weight: number }[]
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

export function isOpenRouterUrl(baseUrl: string): boolean {
  return /(^|\/\/|\.)openrouter\.ai(\/|$)/i.test(baseUrl)
}

export function isGptImageModel(model: string | undefined): boolean {
  return Boolean(model && /(^|\/)gpt-image/i.test(model.trim()))
}

export function aspectRatioForDimensions(width: number, height: number): '1:1' | '4:3' | '3:4' | '16:9' | '9:16' {
  const ratio = width / Math.max(1, height)
  if (ratio >= 1.5) return '16:9'
  if (ratio >= 1.15) return '4:3'
  if (ratio <= 0.67) return '9:16'
  if (ratio <= 0.87) return '3:4'
  return '1:1'
}

export function normalizeOpenAiImageSize(model: string | undefined, baseUrl: string, width: number, height: number): string {
  const m = (model ?? '').trim().toLowerCase()
  const isOfficialOpenAi = !baseUrl || /api\.openai\.com/i.test(baseUrl)
  if (/(^|\/)gpt-image/.test(m)) {
    const ratio = width / Math.max(1, height)
    if (ratio >= 1.18) return '1536x1024'
    if (ratio <= 0.85) return '1024x1536'
    return '1024x1024'
  }
  if (/(^|\/)dall-e-3/.test(m)) {
    const ratio = width / Math.max(1, height)
    if (ratio >= 1.18) return '1792x1024'
    if (ratio <= 0.85) return '1024x1792'
    return '1024x1024'
  }
  if (/(^|\/)dall-e-2/.test(m)) {
    const maxDim = Math.max(width, height)
    if (maxDim <= 384) return '256x256'
    if (maxDim <= 768) return '512x512'
    return '1024x1024'
  }
  if (isOfficialOpenAi) {
    const ratio = width / Math.max(1, height)
    if (ratio >= 1.18) return '1536x1024'
    if (ratio <= 0.85) return '1024x1536'
    return '1024x1024'
  }
  return `${width}x${height}`
}

async function decodeImageRef(ref: string, fallbackWidth: number, fallbackHeight: number, signal: AbortSignal): Promise<ImageOutputPayload> {
  const trimmed = ref.trim()
  const dataMatch = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/)
  if (dataMatch) {
    const bytes = Buffer.from(dataMatch[2].replace(/\s+/g, ''), 'base64')
    const dims = imageDimensions(bytes, fallbackWidth, fallbackHeight)
    return { bytes, mime: dataMatch[1], seed: null, ...dims }
  }
  if (/^https?:\/\//i.test(trimmed)) {
    const fetched = await fetch(trimmed, { signal })
    if (!fetched.ok) throw new Error(`Could not download generated image (${fetched.status}).`)
    const bytes = Buffer.from(await fetched.arrayBuffer())
    const dims = imageDimensions(bytes, fallbackWidth, fallbackHeight)
    return { bytes, mime: fetched.headers.get('content-type')?.split(';')[0] || 'image/png', seed: null, ...dims }
  }
  const bytes = Buffer.from(trimmed.replace(/\s+/g, ''), 'base64')
  const dims = imageDimensions(bytes, fallbackWidth, fallbackHeight)
  return { bytes, mime: 'image/png', seed: null, ...dims }
}

export async function extractChatCompletionImage(
  json: unknown,
  fallbackWidth: number,
  fallbackHeight: number,
  signal: AbortSignal
): Promise<ImageOutputPayload> {
  const rec = (json && typeof json === 'object' ? json : {}) as {
    choices?: {
      message?: {
        content?: unknown
        images?: Array<{ image_url?: { url?: string }; url?: string; b64_json?: string; data?: string }>
      }
      finish_reason?: string
    }[]
  }
  const msg = rec.choices?.[0]?.message
  for (const img of msg?.images ?? []) {
    const ref = img.image_url?.url ?? img.url ?? img.b64_json ?? img.data
    if (typeof ref === 'string' && ref.trim()) return decodeImageRef(ref, fallbackWidth, fallbackHeight, signal)
  }
  const textSnippets: string[] = []
  if (Array.isArray(msg?.content)) {
    for (const part of msg.content) {
      if (!part || typeof part !== 'object') continue
      const p = part as Record<string, unknown>
      const imageUrl = p.image_url && typeof p.image_url === 'object' ? (p.image_url as { url?: unknown }).url : p.image_url
      if (typeof imageUrl === 'string' && imageUrl.trim()) return decodeImageRef(imageUrl, fallbackWidth, fallbackHeight, signal)
      if (typeof p.b64_json === 'string' && p.b64_json.trim()) return decodeImageRef(p.b64_json, fallbackWidth, fallbackHeight, signal)
      const inline = (p.inline_data ?? p.inlineData) as { data?: unknown; mime_type?: unknown; mimeType?: unknown } | undefined
      if (inline && typeof inline.data === 'string' && inline.data.trim()) {
        const mime = String(inline.mimeType ?? inline.mime_type ?? 'image/png')
        return decodeImageRef(`data:${mime};base64,${inline.data}`, fallbackWidth, fallbackHeight, signal)
      }
      if (typeof p.text === 'string' && p.text.trim()) textSnippets.push(p.text.trim())
    }
  } else if (typeof msg?.content === 'string') {
    const dataUrlMatch = msg.content.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/)
    if (dataUrlMatch) return decodeImageRef(dataUrlMatch[0], fallbackWidth, fallbackHeight, signal)
    const mdImgMatch = msg.content.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/)
    if (mdImgMatch) return decodeImageRef(mdImgMatch[1], fallbackWidth, fallbackHeight, signal)
    if (msg.content.trim()) textSnippets.push(msg.content.trim())
  }
  const replyPreview = textSnippets.join(' ').slice(0, 220)
  const hint = replyPreview
    ? `Model replied with text instead of an image: "${replyPreview}" — make sure this remote model supports image output.`
    : 'The remote model returned no image data. Make sure the configured model ID supports image generation.'
  throw new Error(hint)
}

async function runOpenAiChatImage(
  baseUrl: string,
  apiKey: string | null,
  model: string | undefined,
  req: ResolvedImageParams,
  signal: AbortSignal
): Promise<ImageOutputPayload> {
  const base = baseUrl.replace(/\/+$/, '')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
  }
  const promptText = req.negativePrompt ? `${req.prompt}\n\nAvoid: ${req.negativePrompt}` : req.prompt
  const content: unknown = req.sourceAssetId
    ? [
        { type: 'image_url', image_url: { url: asDataUrl(readAssetImage(req.sourceAssetId, 'Source')) } },
        ...(req.maskAssetId ? [{ type: 'image_url', image_url: { url: asDataUrl(readAssetImage(req.maskAssetId, 'Mask')) } }] : []),
        { type: 'text', text: promptText }
      ]
    : promptText
  const aspectRatio = aspectRatioForDimensions(req.width, req.height)
  const body: Record<string, unknown> = {
    ...(model ? { model } : {}),
    messages: [{ role: 'user', content }],
    modalities: ['image', 'text'],
    ...(isOpenRouterUrl(base) ? { image_config: { aspect_ratio: aspectRatio } } : {})
  }
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal
  })
  if (!res.ok) throw await parseError(res, isOpenRouterUrl(base) ? 'OpenRouter image generation' : 'Image API')
  return extractChatCompletionImage(await res.json(), req.width, req.height, signal)
}

function formatFetchError(err: unknown, what: string): Error {
  if (!(err instanceof Error)) return new Error(`${what} failed: ${String(err)}`)
  const cause = (err as { cause?: { code?: string; message?: string } }).cause
  const detail = [cause?.code, cause?.message].filter(Boolean).join(' — ')
  if (detail && err.message === 'fetch failed') {
    return new Error(`${what} connection failed (${detail}).`)
  }
  return err
}

async function encodeMultipartForm(form: FormData): Promise<{ body: ArrayBuffer; contentType: string }> {
  const encoded = new Response(form)
  const contentType = encoded.headers.get('content-type') || 'multipart/form-data'
  const body = await encoded.arrayBuffer()
  return { body, contentType }
}

async function runOpenAiLike(baseUrl: string, apiKey: string | null, model: string | undefined, withSdCpp: boolean, req: ResolvedImageParams, signal: AbortSignal): Promise<ImageOutputPayload> {
  const base = baseUrl.replace(/\/+$/, '')
  if (!withSdCpp && isOpenRouterUrl(base)) {
    return runOpenAiChatImage(base, apiKey, model, req, signal)
  }
  const gptImage = !withSdCpp && isGptImageModel(model)
  const size = withSdCpp ? `${req.width}x${req.height}` : normalizeOpenAiImageSize(model, base, req.width, req.height)
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
    if (withSdCpp || gptImage) form.append('output_format', 'png')
    else form.append('response_format', 'b64_json')
    const multipart = await encodeMultipartForm(form)
    let res: Response
    try {
      res = await fetch(`${base}/images/edits`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': multipart.contentType },
        body: multipart.body,
        signal
      })
    } catch (err) {
      throw formatFetchError(err, what)
    }
    if (!withSdCpp && (res.status === 404 || res.status === 405)) {
      return runOpenAiChatImage(base, apiKey, model, req, signal)
    }
    if (!res.ok) throw await parseError(res, what)
    return extractOpenAiImage(await res.json(), req.width, req.height, signal)
  }

  const body: Record<string, unknown> = {
    ...(model && !withSdCpp ? { model } : {}),
    prompt: promptText,
    size,
    n: 1,
    ...(withSdCpp || gptImage ? { output_format: 'png' } : { response_format: 'b64_json' })
  }
  let res: Response
  try {
    res = await fetch(`${base}/images/generations`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    })
  } catch (err) {
    throw formatFetchError(err, what)
  }
  if (!withSdCpp && (res.status === 404 || res.status === 405)) {
    return runOpenAiChatImage(base, apiKey, model, req, signal)
  }
  if (!res.ok) throw await parseError(res, what)
  return extractOpenAiImage(await res.json(), req.width, req.height, signal)
}

function appendLoraTags(prompt: string, loras?: { stem: string; weight: number }[]): string {
  if (!loras?.length) return prompt
  const tags: string[] = []
  const lower = prompt.toLowerCase()
  for (const lora of loras) {
    const marker = `<lora:${lora.stem.toLowerCase()}:`
    if (lower.includes(marker)) continue
    const w = Math.round(lora.weight * 100) / 100
    tags.push(`<lora:${lora.stem}:${w}>`)
  }
  return tags.length ? `${prompt} ${tags.join(' ')}` : prompt
}

function normalizePreviewDataUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('data:image/')) return trimmed
  const mime = trimmed.startsWith('/9j/') ? 'image/jpeg' : trimmed.startsWith('UklGR') ? 'image/webp' : 'image/png'
  return `data:${mime};base64,${trimmed}`
}

interface SdCppProgressPayload {
  stage?: string
  detail?: string
  completed?: number | null
  total?: number | null
  elapsed_ms?: number
  preview?: string | null
  preview_b64?: string | null
  preview_image?: string | null
}

interface SdCppJobResponse {
  id: string
  status?: string
  poll_url?: string
  progress?: SdCppProgressPayload
  preview?: string | null
  preview_b64?: string | null
  preview_image?: string | null
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
  const promptWithLoras = appendLoraTags(req.prompt, req.loras)
  const body: Record<string, unknown> = {
    prompt: promptWithLoras,
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

  onProgress?.({ stage: 'submitting', detail: '', completed: null, total: null, elapsedMs: 0, previewDataUrl: null })
  let submitRes: Response
  try {
    submitRes = await fetch(`${base}/sdcpp/v1/img_gen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    })
  } catch (err) {
    if (signal.aborted) throw err
    // If sd-server closed the socket on a large JSON ref_images payload, retry via buffered multipart /v1/images/edits
    if (req.sourceAssetId) {
      onProgress?.({ stage: 'sampling', detail: '', completed: null, total: null, elapsedMs: 0, previewDataUrl: null })
      return runOpenAiLike(`${base}/v1`, null, modelName, true, { ...req, prompt: promptWithLoras }, signal)
    }
    throw formatFetchError(err, 'sd-server')
  }
  if (submitRes.status === 404 || submitRes.status === 405 || (req.sourceAssetId && submitRes.status === 413)) {
    onProgress?.({ stage: 'sampling', detail: '', completed: null, total: null, elapsedMs: 0, previewDataUrl: null })
    return runOpenAiLike(`${base}/v1`, null, modelName, true, { ...req, prompt: promptWithLoras }, signal)
  }
  if (!submitRes.ok) throw await parseError(submitRes, 'sd-server')

  const created = (await submitRes.json()) as SdCppJobResponse
  const pollUrl = created.poll_url?.startsWith('http') ? created.poll_url : `${base}${created.poll_url || `/sdcpp/v1/jobs/${created.id}`}`
  let lastPreviewUrl: string | null = null

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
      throw formatFetchError(err, 'sd-server')
    }
    if (!pollRes.ok) throw await parseError(pollRes, 'sd-server')
    const job = (await pollRes.json()) as SdCppJobResponse
    const inlinePreview = normalizePreviewDataUrl(
      job.progress?.preview_b64 ??
        job.progress?.preview ??
        job.progress?.preview_image ??
        job.preview_b64 ??
        job.preview ??
        job.preview_image
    )
    if (inlinePreview) lastPreviewUrl = inlinePreview

    const completedStep = typeof job.progress?.completed === 'number' ? job.progress.completed : null
    if (job.progress?.stage) {
      onProgress?.({
        stage: job.progress.stage,
        detail: job.progress.detail ?? '',
        completed: completedStep,
        total: typeof job.progress.total === 'number' ? job.progress.total : null,
        elapsedMs: typeof job.progress.elapsed_ms === 'number' ? job.progress.elapsed_ms : 0,
        previewDataUrl: lastPreviewUrl
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

async function runGoogleInteractionImage(
  base: string,
  model: string,
  headers: Record<string, string>,
  req: ResolvedImageParams,
  signal: AbortSignal
): Promise<ImageOutputPayload> {
  const input: Record<string, unknown>[] = []
  if (req.sourceAssetId) {
    const source = readAssetImage(req.sourceAssetId, 'Source')
    input.push({ type: 'image', mime_type: source.mime, data: source.bytes.toString('base64') })
  }
  if (req.maskAssetId) {
    const mask = readAssetImage(req.maskAssetId, 'Mask')
    input.push({ type: 'image', mime_type: mask.mime, data: mask.bytes.toString('base64') })
  }
  input.push({ type: 'text', text: req.negativePrompt ? `${req.prompt}\n\nAvoid: ${req.negativePrompt}` : req.prompt })
  const res = await fetch(`${base}/interactions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, input }),
    signal
  })
  if (!res.ok) throw await parseError(res, 'Google Gemini image generation')
  const json = (await res.json()) as {
    output_image?: { data?: string; mime_type?: string; mimeType?: string }
    outputs?: Array<{ type?: string; data?: string; mime_type?: string; mimeType?: string }>
    steps?: Array<{ outputs?: Array<{ type?: string; data?: string; mime_type?: string; mimeType?: string }> }>
  }
  if (json.output_image?.data) {
    const bytes = Buffer.from(json.output_image.data, 'base64')
    const dims = imageDimensions(bytes, req.width, req.height)
    return { bytes, mime: json.output_image.mime_type || json.output_image.mimeType || 'image/png', seed: null, ...dims }
  }
  const allOutputs = [
    ...(json.outputs ?? []),
    ...(json.steps ?? []).flatMap((s) => s.outputs ?? [])
  ]
  for (const out of allOutputs) {
    if (out.data && (!out.type || out.type === 'image')) {
      const bytes = Buffer.from(out.data, 'base64')
      const dims = imageDimensions(bytes, req.width, req.height)
      return { bytes, mime: out.mime_type || out.mimeType || 'image/png', seed: null, ...dims }
    }
  }
  throw new Error('Google Gemini returned no image data.')
}

async function runGoogleImage(spec: RemoteSpec, key: string | null, req: ResolvedImageParams, signal: AbortSignal): Promise<ImageOutputPayload> {
  if (!key) throw new Error('Add a Google Gemini API key for this remote model first.')
  const base = normalizeGoogleBase(spec.baseUrl)
  const model = spec.model.replace(/^models\//i, '').trim()
  const headers = { 'x-goog-api-key': key, 'Content-Type': 'application/json' }
  const aspectRatio = aspectRatioForDimensions(req.width, req.height)

  if (/^imagen-/i.test(model) && !req.sourceAssetId) {
    const res = await fetch(`${base}/models/${encodeURIComponent(model)}:predict`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ instances: [{ prompt: req.prompt }], parameters: { sampleCount: 1, aspectRatio } }),
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

  const callGenerateContent = (includeImageConfig: boolean) =>
    fetch(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          ...(includeImageConfig ? { imageConfig: { aspectRatio } } : {})
        }
      }),
      signal
    })

  let res = await callGenerateContent(true)
  if (!res.ok && res.status === 400) {
    const firstErr = await parseError(res, 'Google Gemini image generation')
    if (/imageConfig|aspectRatio|Unknown name/i.test(firstErr.message)) {
      res = await callGenerateContent(false)
    } else if (/generateContent.*not supported|not found/i.test(firstErr.message)) {
      return runGoogleInteractionImage(base, model, headers, req, signal)
    } else {
      throw firstErr
    }
  }
  if (!res.ok && res.status === 404 && /nano-banana/i.test(model)) {
    return runGoogleInteractionImage(base, model, headers, req, signal)
  }
  if (!res.ok) throw await parseError(res, 'Google Gemini image generation')
  const json = (await res.json()) as {
    promptFeedback?: { blockReason?: string }
    candidates?: {
      finishReason?: string
      content?: {
        parts?: { text?: string; inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } }[]
      }
    }[]
  }
  const textNotes: string[] = []
  for (const cand of json.candidates ?? []) {
    for (const part of cand.content?.parts ?? []) {
      const inline = part.inlineData ?? (part.inline_data ? { data: part.inline_data.data, mimeType: part.inline_data.mime_type } : null)
      if (inline?.data) {
        const bytes = Buffer.from(inline.data, 'base64')
        const dims = imageDimensions(bytes, req.width, req.height)
        return { bytes, mime: inline.mimeType || 'image/png', seed: null, ...dims }
      }
      if (part.text?.trim()) textNotes.push(part.text.trim())
    }
  }
  const blockReason = json.promptFeedback?.blockReason
  const finishReason = json.candidates?.[0]?.finishReason
  if (blockReason) throw new Error(`Google Gemini blocked the image request (${blockReason}).`)
  if (textNotes.length) {
    throw new Error(`Google Gemini returned text instead of an image: "${textNotes.join(' ').slice(0, 220)}" (make sure "${model}" is an image-capable Gemini model).`)
  }
  throw new Error(`Google Gemini returned no image part${finishReason ? ` (${finishReason})` : ''}. Make sure "${model}" is an image-capable model (e.g. gemini-2.5-flash-image).`)
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
