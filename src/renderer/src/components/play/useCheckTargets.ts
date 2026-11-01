import { checkTargets, type Action, type CheckTarget } from '@shared/actions'
import { engine } from '../../lib/ipc'
import { useLibraryData } from '../../lib/useLive'
import { useAgents } from '../../store/agents'

export function useActionSheet(action: Pick<Action, 'by'>, character: string | null): string | null {
  const agents = useAgents((s) => s.list)
  return action.by ? (agents.find((a) => a.id === action.by)?.sheet ?? null) : character
}

export function useCheckTargets(sheetId: string | null): CheckTarget[] {
  const sheet = useLibraryData(() => (sheetId ? engine('sheets.get', { id: sheetId }) : Promise.resolve(null)), `action.sheet.${sheetId ?? ''}`)
  return checkTargets(sheet?.dnd ?? null)
}
