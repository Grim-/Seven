import fs from 'node:fs'
import { gguf } from '@huggingface/gguf'
import type { ModelInfo } from '@shared/types'
import { classify } from './classify'
import { resolveSplit } from './facts/split'
import { viewOf, type GgufMeta } from './view'

const SKIPPED = ['tokenizer.ggml.tokens', 'tokenizer.ggml.token_type', 'tokenizer.ggml.scores', 'tokenizer.ggml.merges']
const PART = /-(\d{5})-of-(\d{5})\.gguf$/i

export interface HeaderRead {
  tokens?: { huggingFace?: string }
  size: boolean
}

export function hubUrl(repo: string, file: string): string {
  return `https://huggingface.co/${repo}/resolve/main/${file.split('/').map(encodeURIComponent).join('/')}`
}

function location(source: string): { url: string; local: boolean } {
  const hf = source.match(/^hf:([^/]+\/[^/]+)\/(.+)$/)
  if (hf) return { url: hubUrl(hf[1], hf[2]), local: false }
  return { url: source, local: !/^https?:\/\//i.test(source) }
}

function plain(value: unknown): unknown {
  if (typeof value === 'bigint') return Number(value)
  if (Array.isArray(value)) return value.map(plain)
  return value
}

function nest(flat: Record<string, unknown>): GgufMeta {
  const root: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(flat)) {
    if (SKIPPED.includes(key)) continue
    const parts = key.split('.')
    let at = root
    for (const part of parts.slice(0, -1)) {
      const next = at[part]
      if (!next || typeof next !== 'object' || Array.isArray(next)) at[part] = {}
      at = at[part] as Record<string, unknown>
    }
    at[parts[parts.length - 1]] = plain(value)
  }
  return root
}

function headers(how: HeaderRead): Record<string, string> {
  return how.tokens?.huggingFace ? { Authorization: `Bearer ${how.tokens.huggingFace}` } : {}
}

async function open(source: string, how: HeaderRead): Promise<{ meta: GgufMeta; tensorNames: string[]; dataOffset: number }> {
  const { url, local } = location(source)
  const read = await gguf(url, local ? { allowLocalFile: true } : { additionalFetchHeaders: headers(how) })
  const offset = Number((read as { tensorDataOffset?: bigint | number }).tensorDataOffset ?? 0)
  const tensorNames = Array.isArray(read.tensorInfos) ? read.tensorInfos.map((t) => t.name).filter((n): n is string => typeof n === 'string') : []
  return { meta: nest(read.metadata as unknown as Record<string, unknown>), tensorNames, dataOffset: Number.isFinite(offset) ? offset : 0 }
}

async function fileSize(source: string, how: HeaderRead): Promise<number | null> {
  const { url, local } = location(source)
  if (local) return fs.statSync(url).size
  const res = await fetch(url, { method: 'HEAD', headers: headers(how) })
  const size = Number(res.headers.get('x-linked-size') ?? res.headers.get('content-length'))
  return res.ok && Number.isFinite(size) && size > 0 ? size : null
}

function partSource(source: string, part: number, parts: number): string {
  return source.replace(PART, `-${String(part).padStart(5, '0')}-of-${String(parts).padStart(5, '0')}.gguf`)
}

async function weights(source: string, how: HeaderRead, dataOffset: number): Promise<number | null> {
  const size = await fileSize(source, how)
  return size === null ? null : size - dataOffset
}

export async function readHeader(source: string, how: HeaderRead): Promise<ModelInfo> {
  const own = await open(source, how)
  const view = viewOf(own.meta, own.tensorNames)
  const split = resolveSplit(view)
  if (!how.size || (split && split.part > 0)) return classify(view, null)
  if (!split || split.parts <= 1 || !PART.test(source)) return classify(view, await weights(source, how, own.dataOffset))
  let total = 0
  for (let n = 1; n <= split.parts; n++) {
    const part = partSource(source, n, split.parts)
    const offset = n === 1 ? own.dataOffset : (await open(part, how)).dataOffset
    const bytes = await weights(part, how, offset)
    if (bytes === null) return classify(view, null)
    total += bytes
  }
  return classify(view, total)
}
