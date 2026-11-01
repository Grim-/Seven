import type { GatherSourceInfo } from '@shared/types'

export interface SourceContext {
  agentId: string | null
  sessionId: string
  signal: AbortSignal
}

export interface Source extends GatherSourceInfo {
  read(data: Record<string, unknown>, ctx: SourceContext): Promise<{ title?: string; text: string }>
}

const registry = new Map<string, Source>()

export function registerSource(source: Source): void {
  registry.set(source.kind, source)
}

export function allSources(): Source[] {
  return [...registry.values()]
}

export function sourceFor(kind: string): Source | undefined {
  return registry.get(kind)
}
