import type { Catalog } from './catalog'
import { GameEntity } from './GameEntity'
import { componentTypes, createComponent, type ComponentClass } from './registry'

export const ENTITY_HOST = 'entity'

const NO_CATALOG: Catalog = {
  stat: () => null,
  stats: () => [],
  damageType: () => null,
  formula: () => null,
  time: () => null,
  times: () => [],
  check: () => null,
  checks: () => [],
  slot: () => null,
  slots: () => [],
  template: () => null,
  entity: () => null
}

export function componentsFor(host: string): ComponentClass[] {
  const made = host === ENTITY_HOST ? new GameEntity('fit', { kind: ENTITY_HOST, id: 'fit' }, 'fit', NO_CATALOG) : createComponent({ type: host })
  if (!made) return []
  return componentTypes().filter((Class) => new Class({}).canApply(made) === true)
}
