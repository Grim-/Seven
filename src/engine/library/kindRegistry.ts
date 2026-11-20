import type { Kind } from './defs/types'

export interface OwnedKind {
  kind: Kind
  module: string | null
}

interface KindSource {
  order: number
  afterOthers: boolean
  list(others: Kind[]): OwnedKind[]
}

const sources = new Map<string, KindSource>()

export function registerKind(order: number, kind: Kind, module: string | null = null): void {
  sources.set(`kind:${kind.kind}`, { order, afterOthers: false, list: () => [{ kind, module }] })
}

export function registerKindSource(id: string, order: number, list: (others: Kind[]) => OwnedKind[], afterOthers = false): void {
  sources.set(`source:${id}`, { order, afterOthers, list })
}

export function ownedKinds(): OwnedKind[] {
  const sorted = [...sources.values()].sort((a, b) => a.order - b.order)
  const first = new Map(sorted.filter((s) => !s.afterOthers).map((s): [KindSource, OwnedKind[]] => [s, s.list([])]))
  const others = [...first.values()].flatMap((list) => list.map((o) => o.kind))
  return sorted.flatMap((s) => first.get(s) ?? s.list(others))
}
