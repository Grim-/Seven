import type { ComponentType } from 'react'

export interface GlanceView {
  View: ComponentType
  entry?: string
}

const glances = new Map<string, GlanceView>()

export function registerGlanceView(id: string, glance: GlanceView): void {
  glances.set(id, glance)
}

export function glanceView(id: string): GlanceView | undefined {
  return glances.get(id)
}
