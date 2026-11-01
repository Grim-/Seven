import { engine } from '../../lib/ipc'
import { useAutosavedState, type AutosavedState } from '../ui'
import { failed } from '../../lib/notify'

export function useModulePageState<T>(pageId: string, start: T): AutosavedState<T> {
  return useAutosavedState<T>(start, (value) => engine('modules.pageAction', { pageId, name: 'save', payload: { json: JSON.stringify(value) } }))
}

export function renamePage(pageId: string, title: string): void {
  void engine('data.pages.write', { id: pageId, title, body: null }).catch(failed('Could not rename'))
}
