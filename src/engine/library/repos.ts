import { drawn } from '@shared/random'
import crypto from 'node:crypto'
import type { RepoEntry } from '@shared/types'
import { data } from '../data/hub'

export const REPO_TYPE = 'repo'
const LEGACY_TYPE = 'storyteller:repo'
export const REPO_TYPES = [REPO_TYPE, LEGACY_TYPE]
const TYPES = REPO_TYPES
const MAX_DEPTH = 10

function clean(raw: unknown): { tags: string[]; scope: 'use' | 'run'; values: string[] } {
  const d = (raw && typeof raw === 'object' ? raw : {}) as { tags?: unknown; scope?: unknown; values?: unknown }
  return {
    tags: (Array.isArray(d.tags) ? d.tags : []).map((t) => String(t).trim().toLowerCase()).filter(Boolean),
    scope: d.scope === 'run' ? 'run' : 'use',
    values: (Array.isArray(d.values) ? d.values : []).map((v) => String(v)).filter((v) => v.trim())
  }
}

export function repoIds(): { id: string; title: string; updatedAt: number }[] {
  return TYPES.flatMap((t) => data.pages.ofType(t)).map((p) => ({ id: p.id, title: p.title, updatedAt: p.updatedAt }))
}

export function isRepo(ref: string): boolean {
  return findRepo(ref) !== null
}

export function findRepo(ref: string): string | null {
  return data.pages.find(ref, (p) => Boolean(p.type && TYPES.includes(p.type)))?.id ?? null
}

export function getRepo(ref: string): RepoEntry {
  const page = data.pages.get(ref)
  if (!page.type || !TYPES.includes(page.type)) throw new Error(`"${page.title}" is not a repo. find with kind repo lists repos.`)
  return { id: page.id, title: page.title, ...clean(page.data), updatedAt: page.updatedAt }
}

export function allRepos(): RepoEntry[] {
  return repoIds().map((r) => getRepo(r.id))
}

export function saveRepo(input: { id: string | null; title: string; tags: string[]; scope: 'use' | 'run'; values: string[] }): RepoEntry {
  const title = input.title.trim()
  if (!title) throw new Error('Give the repo a name, e.g. Fantasy races.')
  const value = clean(input)
  if (input.id) {
    const page = data.pages.get(input.id)
    if (!page.type || !TYPES.includes(page.type)) throw new Error(`"${page.title}" is not a repo. find with kind repo lists repos.`)
    if (title !== page.title) data.pages.write({ ref: page.id, title })
    data.pages.setData(page.id, value)
    return getRepo(page.id)
  }
  const page = data.pages.create({ title, type: REPO_TYPE, data: value })
  return getRepo(page.id)
}

function pick<T>(list: T[]): T {
  return list[crypto.randomInt(list.length)]
}

function byName(name: string, list: RepoEntry[]): RepoEntry | undefined {
  const key = name.trim().toLowerCase()
  return list.find((r) => r.title.toLowerCase() === key || r.id === key)
}

export function expandRepoText(text: string, depth = 0, list: RepoEntry[] = allRepos()): string {
  if (depth >= MAX_DEPTH) return text
  let changed = false
  const out = text.replace(/\{([^{}]+)\}/g, (match, inner: string) => {
    const key = inner.split('#')[0].trim()
    const pool = key.toLowerCase().startsWith('tag:') ? list.filter((r) => r.tags.includes(key.slice(4).trim().toLowerCase()) && r.values.length) : [byName(key, list)].filter((r): r is RepoEntry => Boolean(r?.values.length))
    if (!pool.length) return match
    changed = true
    return pick(pick(pool).values)
  })
  return changed ? expandRepoText(out, depth + 1, list) : out
}

export function rollRepo(ref: string): string {
  const repo = getRepo(ref)
  if (!repo.values.length) throw new Error(`The repo "${repo.title}" has no values yet. Add some with repo_write first.`)
  return expandRepoText(pick(repo.values))
}

export function drawRepo(ref: string, count: number): string[] {
  const repo = getRepo(ref)
  if (!repo.values.length) throw new Error(`The repo "${repo.title}" has no values yet. Add some with repo_write first.`)
  return drawn(repo.values, count).map((v) => expandRepoText(v))
}

export function repoMarkdown(ref: string): string {
  const r = getRepo(ref)
  return `# ${r.title}\n${r.tags.length ? `Tags: ${r.tags.join(', ')}\n` : ''}${r.values.length} values:\n${r.values.map((v) => `- ${v}`).join('\n') || '(none yet)'}`
}
