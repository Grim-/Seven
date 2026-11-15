import type { Kind, KindContext } from './kinds'
import { modules } from '../modules/registry'
import { agentAccess } from '../agents/access'
import { contribute } from '../modules/contributions'

const registered = new Map<string, { module: string; kind: Kind }>()

export function registerModuleKind(module: string, kind: Kind): void {
  registered.set(kind.kind, { module, kind })
  contribute(module, 'Kind', kind.plural)
}

function moduleOn(module: string, ctx: KindContext): boolean {
  if (modules.list().find((m) => m.id === module)?.state !== 'on') return false
  if (ctx.user || !ctx.agentId || ctx.agentId === '_any') return true
  return agentAccess.get(ctx.agentId)?.modules.includes(module) === true
}

export function moduleKinds(): Kind[] {
  return [...registered.values()].map(({ module, kind }) => ({ ...kind, available: (ctx: KindContext) => moduleOn(module, ctx) && kind.available(ctx) }))
}
