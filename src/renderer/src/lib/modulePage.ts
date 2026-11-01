import { engine } from './ipc'
import { useAutosavedState, type AutosavedState } from '../components/ui'
import { failed } from './notify'

export function useModulePageState<T>(pageId: string, start: T): AutosavedState<T> {
  return useAutosavedState<T>(start, (value) => engine('modules.pageAction', { pageId, name: 'save', payload: { json: JSON.stringify(value) } }))
}

export function renamePage(pageId: string, title: string): void {
  void engine('data.pages.write', { id: pageId, title, body: null }).catch(failed('Could not rename'))
}
