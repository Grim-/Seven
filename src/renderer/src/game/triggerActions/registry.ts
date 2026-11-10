import type { ComponentType } from 'react'
import type { GameExecutionContext } from './context'

export interface TriggerActionEditorProps<P = Record<string, unknown>> {
  world?: string
  params: P
  onChange: (next: P) => void
}

export interface TriggerActionHandler<P = Record<string, unknown>> {
  type: string
  label: string
  description: string
  icon?: string
  Editor: ComponentType<TriggerActionEditorProps<P>>
  execute: (params: P, ctx: GameExecutionContext) => Promise<void> | void
}

const handlers = new Map<string, TriggerActionHandler<any>>()

/**
 * Register any built-in, module, addon, or user-created trigger action behavior.
 * ZERO switch statements — pluggable registry pattern.
 */
export function registerTriggerActionHandler<P = Record<string, unknown>>(
  handler: TriggerActionHandler<P>
): void {
  handlers.set(handler.type, handler as TriggerActionHandler<any>)
}

export function getTriggerActionHandler(type: string): TriggerActionHandler | null {
  return handlers.get(type) ?? null
}

export function allTriggerActionHandlers(): TriggerActionHandler[] {
  return [...handlers.values()]
}
