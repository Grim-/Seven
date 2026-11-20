import type { Kind } from './kinds'
import { contribute } from '../modules/contributions'
import { registerKind } from './kindRegistry'

const MODULE_KIND_ORDER = 100

export function registerModuleKind(module: string, kind: Kind, order = MODULE_KIND_ORDER): void {
  registerKind(order, kind, module)
  contribute(module, 'Kind', kind.plural)
}
