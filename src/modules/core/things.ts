import type { WidgetSource } from '@shared/types'
import { mergeWidgetSources } from '../../engine/data/widgetSources'
import { partSource } from '../../engine/library/partWidget'
import { entryId, find as libraryFind, kindOf, kinds, linkPart, partMiss, type Kind, type KindContext } from '../../engine/library/kinds'
import { ToolError, type ToolContext } from '../../engine/tools/types'
import { canShowPaths, registerShownFile } from '../../engine/tools/shown'
import { pathExists, pathLike } from '../read/tools'

export function hitId(h: { kind: string; id: string; title: string }, kctx: KindContext): string {
  const k = kinds(kctx).find((x) => x.kind === h.kind)
  return k ? entryId(k, h.id, h.title, kctx) : h.id
}

export function thingsFrom(value: unknown, ctx: ToolContext): string[] {
  return (Array.isArray(value) ? value : [])
    .map((t) => String(t).trim())
    .filter(Boolean)
    .map((t) => (canShowPaths(ctx) && pathLike(t, ctx) && pathExists(t, ctx) ? `file/${registerShownFile(t, ctx)}` : t))
}

export interface Found {
  kind: Kind
  id: string
  part: string | null
}

export function resolveEntries(things: string[], kctx: KindContext): { found: Found[]; notes: string[] } {
  const found: Found[] = []
  const notes: string[] = []
  const unknown: string[] = []
  for (const thing of things) {
    let entry: { kind: Kind; id: string }
    try {
      entry = kindOf(thing, kctx)
    } catch {
      unknown.push(thing)
      continue
    }
    const part = linkPart(thing)
    const miss = partMiss(thing, part, kctx)
    if (miss) notes.push(miss)
    found.push({ ...entry, part: miss ? null : part })
  }
  if (unknown.length) {
    const near = unknown.map((u) => {
      const hits = libraryFind(u.split(/\s+/)[0], null, 3, kctx).slice(0, 4)
      return hits.length ? `${u} (close: ${hits.map((h) => `${h.kind} ${hitId(h, kctx)}`).join(', ')})` : u
    })
    throw new ToolError(`Not found: ${near.join('; ')}. find shows what exists.`)
  }
  return { found, notes }
}

export function resolveThings(things: string[], onBoard: boolean, kctx: KindContext): { sources: WidgetSource[]; notes: string[] } {
  const { found, notes } = resolveEntries(things, kctx)
  const sources = found.map((f) => f.kind.place?.(f.id, f.part, onBoard) ?? (f.kind.presents?.widget ? { kind: f.kind.kind, id: f.id, part: f.part } : partSource(`${f.kind.kind}/${f.id}`, f.part, kctx)))
  return { sources: mergeWidgetSources(sources), notes }
}
