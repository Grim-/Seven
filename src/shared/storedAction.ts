import { toId } from './ids'
import { actionText, cleanAction, type Action } from './actions'
import { cleanTagList } from './storedDecision'

export interface StoredAction {
  id: string
  name: string
  action: Action
  tags: string[]
}

export function blankStoredAction(): StoredAction {
  return { id: '', name: '', action: cleanAction({}), tags: [] }
}

export function cleanStoredAction(raw: unknown): StoredAction | null {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const name = typeof v.name === 'string' ? v.name.trim() : ''
  if (!name) return null
  return { id: (typeof v.id === 'string' && toId(v.id)) || toId(name), name, action: cleanAction(v.action), tags: cleanTagList(v.tags) }
}

export function storedActionText(a: StoredAction): string {
  return [`Action "${a.name}"${a.tags.length ? `; tags: ${a.tags.join(', ')}` : ''}.`, actionText(a.action), 'Roll it with action_check.'].join('\n')
}
