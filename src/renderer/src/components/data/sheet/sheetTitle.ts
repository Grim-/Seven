import { engine } from '../../../lib/ipc'
import { noteFailure } from '../../../store/problems'

export function sheetTitle(id: string | null): Promise<string | null> {
  if (!id) return Promise.resolve(null)
  return engine('sheets.get', { id }).then(
    (s) => s.title,
    noteFailure('sheets', 'Could not read the character', () => null)
  )
}
