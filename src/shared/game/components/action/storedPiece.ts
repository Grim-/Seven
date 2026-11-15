import type { ComponentDef } from '../../core/registry'

export const USE_TRIGGER_ACTION = 'action.useTriggerAction'

export function storedPiece(id: string | null, on: string): ComponentDef[] {
  return id ? [{ type: USE_TRIGGER_ACTION, on, action: id }] : []
}
