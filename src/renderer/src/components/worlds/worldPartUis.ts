import type { ComponentType } from 'react'

export interface WorldPartSurfaceProps {
  worldId: string
  itemKey: string
  part?: string | null
}

export interface WorldPartUi {
  Chat: ComponentType<WorldPartSurfaceProps>
  Widget?: ComponentType<WorldPartSurfaceProps>
}

const partUis = new Map<string, WorldPartUi>()

export function registerWorldPartUi(segment: string, ui: WorldPartUi): void {
  partUis.set(segment, ui)
}

export function worldPartUi(segment: string): WorldPartUi | undefined {
  return partUis.get(segment)
}
