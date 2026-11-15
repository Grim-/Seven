import { noteFailure } from '../util/report'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { dataRoot } from '../util/paths'
import { readJson, writeJson } from '../util/fs'
import { vaultEvents } from '../util/secure'

const FILE = path.join(dataRoot, 'tags.json')

export function cleanTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function splitTags(query: string): { text: string; tags: string[] } {
  const tags: string[] = []
  const text = query
    .replace(/(^|\s)#([^\s#]+)/g, (_m, pre: string, tag: string) => {
      const t = cleanTag(tag)
      if (t) tags.push(t)
      return pre
    })
    .trim()
  return { text, tags }
}

class Tags extends EventEmitter {
  private cache: Record<string, string[]> | null = null

  private all(): Record<string, string[]> {
    this.cache ??= readJson<Record<string, string[]>>(FILE, {})
    return this.cache
  }

  forget(): void {
    this.cache = null
  }

  of(kind: string, id: string): string[] {
    try {
      return this.all()[`${kind}/${id}`] ?? []
    } catch (err) {
      noteFailure(err, 'library', 'Could not read the tags')
      return []
    }
  }

  set(kind: string, id: string, tags: string[]): string[] {
    const next = [...new Set(tags.map(cleanTag).filter(Boolean))].slice(0, 20)
    const all = { ...this.all() }
    if (next.length) all[`${kind}/${id}`] = next
    else delete all[`${kind}/${id}`]
    writeJson(FILE, all)
    this.cache = all
    this.emit('changed')
    return next
  }

  change(kind: string, id: string, add: string[], remove: string[]): string[] {
    const drop = new Set(remove.map(cleanTag))
    return this.set(kind, id, [...this.of(kind, id), ...add].filter((t) => !drop.has(cleanTag(t))))
  }

  map(): Record<string, string[]> {
    try {
      return { ...this.all() }
    } catch (err) {
      noteFailure(err, 'library', 'Could not read the tags')
      return {}
    }
  }

  counts(kind?: string): { tag: string; count: number }[] {
    const counts = new Map<string, number>()
    let all: Record<string, string[]> = {}
    try {
      all = this.all()
    } catch (err) {
      noteFailure(err, 'library', 'Could not read the tags')
      return []
    }
    for (const [ref, list] of Object.entries(all)) {
      if (kind && !ref.startsWith(`${kind}/`)) continue
      for (const t of list) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
  }
}

export const tags = new Tags()

vaultEvents.on('locked', () => tags.forget())
vaultEvents.on('unlocked', () => tags.forget())
