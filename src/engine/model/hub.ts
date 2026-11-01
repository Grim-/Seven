import path from 'node:path'
import { MODEL_KINDS, type HubFile, type HubModel, type ModelInfo } from '@shared/types'
import { readHeader } from './gguf/read'
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

export async function searchHub(query: string): Promise<HubModel[]> {
  const params = new URLSearchParams({ filter: 'gguf', sort: 'downloads', direction: '-1', limit: '200' })
  if (query.trim()) params.set('search', query.trim())
  for (const field of ['downloads', 'likes', 'lastModified', 'gguf', 'gated']) params.append('expand[]', field)
  const list = await getJson<unknown[]>(`${SITE}/api/models?${params}`, 'search models')
  return (Array.isArray(list) ? list : []).flatMap((raw): HubModel[] => {
    const m = obj(raw)
    if (typeof m.id !== 'string') return []
    const gguf = obj(m.gguf)
    const updated = typeof m.lastModified === 'string' ? Date.parse(m.lastModified) : NaN
    return [
      {
        id: m.id,
        downloads: num(m.downloads) ?? 0,
        likes: num(m.likes) ?? 0,
        updatedAt: Number.isFinite(updated) ? updated : null,
        params: num(gguf.total),
        architecture: typeof gguf.architecture === 'string' ? gguf.architecture : null,
        contextLength: num(gguf.context_length),
        gated: m.gated !== false && m.gated !== undefined && m.gated !== null
      }
    ]
  })
}

export async function hubFiles(repo: string): Promise<HubFile[]> {
  const tree = await getJson<unknown[]>(`${SITE}/api/models/${repo}/tree/main?recursive=true`, `list the files in ${repo}`)
  return (Array.isArray(tree) ? tree : [])
    .flatMap((raw): HubFile[] => {
      const entry = obj(raw)
      const file = typeof entry.path === 'string' ? entry.path : ''
      if (entry.type !== 'file' || path.posix.extname(file).toLowerCase() !== '.gguf') return []
      return [{ file, name: path.posix.basename(file, path.posix.extname(file)), fileBytes: num(obj(entry.lfs).size) ?? num(entry.size) ?? 0 }]
    })
    .sort((a, b) => a.fileBytes - b.fileBytes)
}

export function hubFileInfo(repo: string, file: string): Promise<ModelInfo> {
  return readHeader(`hf:${repo}/${file}`, { tokens: hubTokens(), size: true })
}

const FACTS_FILE = path.join(dataRoot, 'hub-facts.json')
let facts: Record<string, { updatedAt: number | null; info: ModelInfo }> | null = null

export async function hubRepoFacts(repo: string, updatedAt: number | null): Promise<ModelInfo | null> {
  facts ??= readJson<Record<string, { updatedAt: number | null; info: ModelInfo }>>(FACTS_FILE, {})
  const cached = facts[repo]
  if (cached && cached.updatedAt === updatedAt) return cached.info
  for (const f of await hubFiles(repo)) {
    const info = await readHeader(`hf:${repo}/${f.file}`, { tokens: hubTokens(), size: false })
    if (!MODEL_KINDS[info.kind].runnable || (info.split && info.split.part > 0)) continue
    facts = { ...facts, [repo]: { updatedAt, info } }
    writeJson(FACTS_FILE, facts)
    return info
  }
  return null
}
