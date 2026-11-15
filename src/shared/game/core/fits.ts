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

export interface ComponentFit {
  Class: ComponentClass
  fits: true | string
}

export function componentFits(host: string): ComponentFit[] {
  const made = host === ENTITY_HOST ? new GameEntity('fit', { kind: ENTITY_HOST, id: 'fit' }, 'fit', NO_CATALOG) : createComponent({ type: host })
  if (!made) return []
  return componentTypes().map((Class) => ({ Class, fits: new Class({}).canApply(made) }))
}

export function componentsFor(host: string): ComponentClass[] {
  return componentFits(host)
    .filter((f) => f.fits === true)
    .map((f) => f.Class)
}
