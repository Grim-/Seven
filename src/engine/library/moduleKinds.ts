import type { Kind } from './kinds'
import { contribute } from '../modules/contributions'
import { registerKind, registerKindSource, unregisterKind, unregisterKindSource, type OwnedKind } from './kindRegistry'
import { data } from '../data/hub'

const MODULE_KIND_ORDER = 100

interface Held {
  module: string
  on: () => void
  off: () => void
  names: () => string[]
  pageTypes: () => string[]
}

const held = new Map<string, Held>()
const live = new Set<string>()
let offAddonTypes: string[] = []

function withhold(): void {
  const off = [...held.entries()].filter(([key]) => !live.has(key)).flatMap(([, h]) => h.pageTypes())
  data.pages.withhold([...off, ...offAddonTypes])
}

export function registerModuleKind(module: string, kind: Kind, order = MODULE_KIND_ORDER): void {
  held.set(`kind:${kind.kind}`, {
    module,
    on: () => registerKind(order, kind, module),
    off: () => unregisterKind(kind.kind),
    names: () => [kind.kind],
    pageTypes: () => kind.pageTypes ?? []
  })
  contribute(module, 'Kind', kind.plural)
  withhold()
}

export function registerModuleKindSource(module: string, id: string, order: number, list: (others: Kind[]) => OwnedKind[], afterOthers = false): void {
  held.set(`source:${id}`, {
    module,
    on: () => registerKindSource(id, order, list, afterOthers),
    off: () => unregisterKindSource(id),
    names: () => list([]).map((o) => o.kind.kind),
    pageTypes: () => []
  })
}

export function syncModuleKinds(on: Set<string>, addonTypesOff: string[]): string[] {
  const gone: string[] = []
  for (const [key, h] of held) {
    const wanted = on.has(h.module)
    if (wanted === live.has(key)) continue
    if (wanted) {
      h.on()
      live.add(key)
    } else {
      gone.push(...h.names())
      h.off()
      live.delete(key)
    }
  }
  offAddonTypes = addonTypesOff
  withhold()
  return gone
}
