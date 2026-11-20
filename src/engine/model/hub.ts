import path from 'node:path'
import { MODEL_KINDS, type HubFamily, type HubFile, type HubModel, type ModelInfo } from '@shared/types'
import { readHeader } from './gguf/read'
import { isGgufFile, isModelFile, readModelInfo } from './weightMeta'
import { dataRoot } from '../util/paths'
import { readJson, writeJson } from '../util/fs'
import { serviceKeys } from './keys'

const SITE = 'https://huggingface.co'
export const HUB_TOKEN = 'huggingface'

export function hubTokens(): { huggingFace?: string } {
  const token = serviceKeys.get(HUB_TOKEN)
  return token ? { huggingFace: token } : {}
}

async function getJson<T>(url: string, what: string): Promise<T> {
  const token = serviceKeys.get(HUB_TOKEN)
  let res: Response
  try {
    res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  } catch (err) {
    throw new Error(`Could not reach Hugging Face to ${what}: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (res.status === 401 || res.status === 403)
    throw new Error(`Hugging Face refused to ${what} (${res.status}). This repo may be gated: accept its terms on huggingface.co, and add your Hugging Face token on the Download page.`)
  if (!res.ok) throw new Error(`Hugging Face could not ${what} (${res.status} ${res.statusText}).`)
  return (await res.json()) as T
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function toHubModel(raw: unknown, family: HubFamily): HubModel | null {
  const m = obj(raw)
  if (typeof m.id !== 'string') return null
  const gguf = obj(m.gguf)
  const updated = typeof m.lastModified === 'string' ? Date.parse(m.lastModified) : NaN
  return {
    id: m.id,
    downloads: num(m.downloads) ?? 0,
    likes: num(m.likes) ?? 0,
    updatedAt: Number.isFinite(updated) ? updated : null,
    params: num(gguf.total),
    architecture: typeof gguf.architecture === 'string' ? gguf.architecture : typeof m.pipeline_tag === 'string' ? m.pipeline_tag : null,
    contextLength: num(gguf.context_length),
    gated: m.gated !== false && m.gated !== undefined && m.gated !== null,
    family,
    pipelineTag: typeof m.pipeline_tag === 'string' ? m.pipeline_tag : null
  }
}

async function queryModels(query: string, extra: Record<string, string>, expand: string[], limit = '100'): Promise<unknown[]> {
  const params = new URLSearchParams({ sort: 'downloads', direction: '-1', limit, ...extra })
  if (query.trim()) params.set('search', query.trim())
  for (const field of expand) params.append('expand[]', field)
  const list = await getJson<unknown[]>(`${SITE}/api/models?${params}`, 'search models')
  return Array.isArray(list) ? list : []
}

const HUB_SEARCHERS: Record<HubFamily, (query: string) => Promise<HubModel[]>> = {
  'image-packs': async () => [],
  gguf: async (query) => {
    const list = await queryModels(query, { filter: 'gguf' }, ['downloads', 'likes', 'lastModified', 'gguf', 'gated', 'pipeline_tag'], '200')
    return list.flatMap((raw) => {
      const m = toHubModel(raw, 'gguf')
      return m ? [m] : []
    })
  },
  'image-gguf': async (query) => {
    const expand = ['downloads', 'likes', 'lastModified', 'gguf', 'gated', 'pipeline_tag']
    const [t2i, i2i] = await Promise.all([
      queryModels(query, { filter: 'gguf', pipeline_tag: 'text-to-image' }, expand, '100'),
      queryModels(query, { filter: 'gguf', pipeline_tag: 'image-to-image' }, expand, '100')
    ])
    const merged = new Map<string, HubModel>()
    for (const raw of [...t2i, ...i2i]) {
      const m = toHubModel(raw, 'image-gguf')
      if (m && !merged.has(m.id)) merged.set(m.id, m)
    }
    return [...merged.values()].sort((a, b) => b.downloads - a.downloads)
  },
  diffusion: async (query) => {
    const expand = ['downloads', 'likes', 'lastModified', 'gated', 'pipeline_tag']
    const [t2i, i2i] = await Promise.all([
      queryModels(query, { pipeline_tag: 'text-to-image' }, expand, '100'),
      queryModels(query, { pipeline_tag: 'image-to-image' }, expand, '100')
    ])
    const merged = new Map<string, HubModel>()
    for (const raw of [...t2i, ...i2i]) {
      const m = toHubModel(raw, 'diffusion')
      if (m && !merged.has(m.id)) merged.set(m.id, m)
    }
    return [...merged.values()].sort((a, b) => b.downloads - a.downloads)
  },
  'image-companions': async (query) => {
    const q = query.trim() || 'flux_text_encoders'
    const expand = ['downloads', 'likes', 'lastModified', 'gated', 'pipeline_tag']
    const [searched, vaeList] = await Promise.all([
      queryModels(q, {}, expand, '100'),
      query.trim() ? Promise.resolve([]) : queryModels('safetensors vae ae', {}, expand, '60')
    ])
    const merged = new Map<string, HubModel>()
    for (const raw of [...searched, ...vaeList]) {
      const m = toHubModel(raw, 'image-companions')
      if (m && !merged.has(m.id)) merged.set(m.id, m)
    }
    return [...merged.values()].sort((a, b) => b.downloads - a.downloads)
  }
}

export async function searchHub(query: string, family: HubFamily = 'gguf'): Promise<HubModel[]> {
  return HUB_SEARCHERS[family](query)
}

function repoLooksLikeImageBundle(paths: string[]): boolean {
  return paths.some((p) => /(^|\/)(vae|vae_approx|diffusion_models|text_encoders|clip_l|clip_g|t5xxl|loras|lora|unet|transformer|ae\.)/i.test(p))
}

export async function hubFiles(repo: string, family: HubFamily = 'gguf'): Promise<HubFile[]> {
  const tree = await getJson<unknown[]>(`${SITE}/api/models/${repo}/tree/main?recursive=true`, `list the files in ${repo}`)
  const entries = (Array.isArray(tree) ? tree : []).flatMap((raw) => {
    const entry = obj(raw)
    const file = typeof entry.path === 'string' ? entry.path : ''
    if (entry.type !== 'file' || !isModelFile(file)) return []
    return [{ file, fileBytes: num(obj(entry.lfs).size) ?? num(entry.size) ?? 0 }]
  })
  const allowAllWeights = family !== 'gguf' || repoLooksLikeImageBundle(entries.map((e) => e.file))
  return entries
    .filter((e) => allowAllWeights || isGgufFile(e.file))
    .map((e) => ({ file: e.file, name: path.posix.basename(e.file, path.posix.extname(e.file)), fileBytes: e.fileBytes }))
    .sort((a, b) => a.fileBytes - b.fileBytes)
}

export function hubFileInfo(repo: string, file: string): Promise<ModelInfo> {
  return readModelInfo(`hf:${repo}/${file}`, { tokens: hubTokens(), size: true })
}

const FACTS_FILE = path.join(dataRoot, 'hub-facts.json')
let facts: Record<string, { updatedAt: number | null; info: ModelInfo }> | null = null

export async function hubRepoFacts(repo: string, updatedAt: number | null): Promise<ModelInfo | null> {
  facts ??= readJson<Record<string, { updatedAt: number | null; info: ModelInfo }>>(FACTS_FILE, {})
  const cached = facts[repo]
  if (cached && cached.updatedAt === updatedAt) return cached.info
  for (const f of await hubFiles(repo, 'gguf')) {
    const info = await readHeader(`hf:${repo}/${f.file}`, { tokens: hubTokens(), size: false })
    if (!MODEL_KINDS[info.kind].runnable || (info.split && info.split.part > 0)) continue
    facts = { ...facts, [repo]: { updatedAt, info } }
    writeJson(FACTS_FILE, facts)
    return info
  }
  return null
}
