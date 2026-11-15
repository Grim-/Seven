import type { ComponentType } from 'react'
import type { Catalog } from '@shared/game/core'
import type { GameSave } from '@shared/game/save'
import type { TriggerDef } from '@shared/game/triggers'
import type { PlaceVisitor } from '@shared/maps'

export interface TriggerContext {
  world: string
  map: string
  sheet: string
  party: PlaceVisitor[]
  save: GameSave | null
  catalog: Catalog | null
  close: () => void
  goTo: (map: string, place: string) => void
  update: (values: Record<string, unknown>) => Promise<unknown>
}

export interface TriggerPanelProps {
  trigger: TriggerDef
  ctx: TriggerContext
}

export interface TriggerEditorProps {
  trigger: TriggerDef
  world: string
  map: string
  onValues: (values: Record<string, unknown>) => void
}

export interface TriggerUi {
  Panel?: ComponentType<TriggerPanelProps>
  run?: (trigger: TriggerDef, ctx: TriggerContext) => void
  Editor?: ComponentType<TriggerEditorProps>
  wide?: boolean
}

const uis = new Map<string, TriggerUi>()

export function registerTriggerUi(type: string, ui: TriggerUi): void {
  uis.set(type, ui)
}

export function triggerUi(type: string): TriggerUi | null {
  return uis.get(type) ?? null
}
