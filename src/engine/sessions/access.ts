import type { SessionSceneBinding } from '@shared/almanac'
import type { ChatMessage, SessionMeta, TodoItem, TodoList } from '@shared/types'
import type { SessionStore } from './store'
import type { SessionFiles } from './files'

let store: SessionStore | null = null
let removeChat: ((id: string) => void) | null = null

export function setSessionAccess(s: SessionStore, remove?: (id: string) => void): void {
  store = s
  removeChat = remove ?? null
}

export function chatFiles(sessionId: string): SessionFiles {
  if (!store) throw new Error('Chats are not available')
  return store.files(sessionId)
}

export const sessionAccess = {
  list(): SessionMeta[] {
    return (store?.list() ?? []).filter((s) => !s.incognito)
  },
  get(id: string): SessionMeta | undefined {
    return store?.list().find((s) => s.id === id)
  },
  isIncognito(id: string | null): boolean {
    return store?.isIncognito(id) ?? false
  },
  messages(id: string): ChatMessage[] {
    return store?.messages(id) ?? []
  },
  todos(id: string): TodoList | null {
    return store?.todos(id) ?? null
  },
  rename(id: string, title: string): void {
    if (!store) throw new Error('Chats are not available')
    store.update(id, { title: title.trim() || 'Untitled' })
  },
  updateScene(id: string, scene: SessionSceneBinding | null): SessionMeta {
    if (!store) throw new Error('Chats are not available')
    return store.update(id, { scene })
  },
  remove(id: string): void {
    if (!removeChat) throw new Error('Chats are not available')
    removeChat(id)
  },
  setTodos(id: string, items: TodoItem[]): TodoList {
    if (!store) throw new Error('Chats are not available')
    return store.setTodos(id, items, false)
  }
}

export function renderTodos(items: TodoItem[]): string {
  if (!items.length) return '(The todo list is empty.)'
  return items.map((t) => `${t.status === 'done' ? '[x]' : t.status === 'doing' ? '[>]' : '[ ]'} ${t.task}`).join('\n')
}
