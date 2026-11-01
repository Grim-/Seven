import type { ComponentType } from 'react'

export interface DraftPreviewProps {
  fields: Record<string, unknown>
}

const registry = new Map<string, ComponentType<DraftPreviewProps>>()

export function registerDraftPreview(tool: string, component: ComponentType<DraftPreviewProps>): void {
  registry.set(tool, component)
}

export function draftPreviewFor(tool: string): ComponentType<DraftPreviewProps> | null {
  return registry.get(tool) ?? null
}
