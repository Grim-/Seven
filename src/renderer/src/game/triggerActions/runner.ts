import type { StoredTriggerAction } from '@shared/game/triggerActions'
import type { CardSwap } from '@shared/cardDecks'
import type { GameExecutionContext } from './context'
import { getTriggerActionHandler } from './registry'

export interface OutcomePayload {
  narrative?: string
  cards?: CardSwap
  triggerActionId?: string | null
}

export interface ExecutionResult {
  executed: boolean
  actionId?: string
  actionType?: string
  error?: string
}

/**
 * Execute a StoredTriggerAction in the game cockpit via its registered handler.
 * No switch statements: handler is looked up in the registry.
 */
export async function runTriggerAction(
  action: StoredTriggerAction,
  ctx: GameExecutionContext
): Promise<void> {
  const handler = getTriggerActionHandler(action.actionType)
  if (!handler) {
    const msg = `No trigger action handler registered for type "${action.actionType}"`
    console.warn(`[TriggerAction] ${msg}`)
    ctx.notify(msg, 'warn')
    return
  }

  try {
    await handler.execute(action.params, ctx)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[TriggerAction] Error executing "${action.name}" (${action.actionType}):`, err)
    ctx.notify(`Trigger Action Failed: ${errorMsg}`, 'danger')
  }
}

/**
 * Retrieve and run a StoredTriggerAction by ID.
 */
export async function runTriggerActionById(
  actionId: string,
  ctx: GameExecutionContext
): Promise<ExecutionResult> {
  if (!actionId.trim()) return { executed: false }

  try {
    const action = await ctx.engine<StoredTriggerAction>('triggerActions.get', { id: actionId.trim() })
    if (!action) {
      const msg = `Trigger action "${actionId}" not found`
      ctx.notify(msg, 'warn')
      return { executed: false, error: msg }
    }

    await runTriggerAction(action, ctx)
    return { executed: true, actionId: action.id, actionType: action.actionType }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    ctx.notify(`Failed running action "${actionId}": ${errorMsg}`, 'danger')
    return { executed: false, error: errorMsg }
  }
}

/**
 * Clean outcome dispatcher.
 * Decoupled from both Chat and Cockpit:
 * - In Game Cockpit: executes the winning/chosen trigger action function deterministically.
 * - In Chat Mode: skips 2D world side-effects safely without crashing or hijacking LLM prompts.
 */
export async function dispatchOutcome(
  outcome: OutcomePayload,
  ctx?: GameExecutionContext | null
): Promise<ExecutionResult> {
  if (!ctx || !outcome.triggerActionId) {
    return { executed: false }
  }

  return await runTriggerActionById(outcome.triggerActionId, ctx)
}
