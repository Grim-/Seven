import type { ComponentType } from 'react'
import type { Catalog, Component, GameEntity } from '@shared/game/core'

export interface PanelProps<T extends Component = Component> {
  comp: T
  entity: GameEntity
  catalog: Catalog
  changed: () => void
}

export interface ComponentPanel {
  Panel: ComponentType<PanelProps>
  wide?: boolean
}

const panels = new Map<string, ComponentPanel>()

export function registerComponentPanel<T extends Component>(type: string, panel: { Panel: ComponentType<PanelProps<T>>; wide?: boolean }): void {
  panels.set(type, panel as ComponentPanel)
}

export function panelFor(comp: Component): ComponentPanel | null {
  for (let proto = Object.getPrototypeOf(comp); proto && proto.constructor; proto = Object.getPrototypeOf(proto)) {
    const type = (proto.constructor as { type?: string }).type
    const found = type ? panels.get(type) : undefined
    if (found) return found
  }
  return null
}
