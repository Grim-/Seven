import { toId } from '@shared/ids'
import type { KindChildInput, KindField, KindHit } from '../library/defs/types'

export interface WorldPart {
  has(world: string, key: string): boolean
  title(world: string, key: string): string
  line(world: string, key: string): string
  card(world: string, key: string): string
  fields(world: string, key: string): KindField[]
  data(world: string, key: string): unknown
  remove(world: string, key: string): void
  children(world: string): KindChildInput[]
  search?(world: string, query: string): KindHit[]
  resolve?(world: string, path: string[]): string | null
  top?: boolean
  inside?(world: string, key: string): KindChildInput[]
}

const parts = new Map<string, WorldPart>()

export function registerWorldPart(segment: string, part: WorldPart): void {
  parts.set(segment, part)
}

export function hasWorldPart(segment: string): boolean {
  return parts.has(segment)
}

export function worldPartSegments(): string[] {
  return [...parts.keys()]
}

export function worldPartOf(id: string): { segment: string; part: WorldPart; world: string; key: string } | null {
  const [world, segment, ...rest] = id.split('/')
  const key = rest.join('/')
  const part = segment ? parts.get(segment) : undefined
  return part && world && segment && key ? { segment, part, world, key } : null
}

export function worldPartCategoryChildren(world: string): KindChildInput[] {
  return [...parts.entries()].flatMap(([segment, part]) =>
    part.top
      ? part.children(world)
      : [
          {
            kind: 'world',
            id: `${world}/${segment}`,
            title: segment
          }
        ]
  )
}

export function worldPartInside(id: string): KindChildInput[] {
  const p = worldPartOf(id)
  return p?.part.inside?.(p.world, p.key) ?? []
}

export function worldPartChildrenForSegment(world: string, segment: string): KindChildInput[] {
  return parts.get(segment)?.children(world) ?? []
}

export function worldPartChildren(world: string): KindChildInput[] {
  return [...parts.values()].flatMap((p) => p.children(world))
}

export function worldPartHits(worldIds: string[], query: string, limit: number): KindHit[] {
  const out: KindHit[] = []
  for (const world of worldIds) {
    for (const part of parts.values()) {
      if (!part.search) continue
      for (const hit of part.search(world, query)) {
        out.push(hit)
        if (out.length >= limit) return out
      }
    }
  }
  return out
}

export function matchRecordKey(records: Record<string, Record<string, unknown>>, want: string, among: string[] = Object.keys(records)): string | null {
  const id = toId(want)
  const lower = want.toLowerCase()
  return among.find((k) => k === want) ?? among.find((k) => k.toLowerCase() === lower || toId(k) === id || toId(String(records[k]?.Name ?? '')) === id || String(records[k]?.Name ?? '').toLowerCase() === lower) ?? null
}

export function resolveWorldPart(ref: string, worldOf: (name: string) => string | null): string | null {
  const [w, segment, ...path] = ref.replace(/^"|"$/g, '').split('/').map((s) => s.trim()).filter(Boolean)
  const part = segment ? parts.get(segment.toLowerCase()) : undefined
  const world = w ? worldOf(w) : null
  if (!part || !world || !path.length) return null
  const exact = path.join('/')
  if (part.has(world, exact)) return `${world}/${segment.toLowerCase()}/${exact}`
  const found = part.resolve?.(world, path)
  return found ? `${world}/${found}` : null
}
