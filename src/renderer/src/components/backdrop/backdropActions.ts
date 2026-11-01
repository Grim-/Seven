import type { Backdrop } from '@shared/types'
import { engine } from '../../lib/ipc'
import { useApp } from '../../store/app'

export type BackdropScope = 'chat' | 'timed' | 'chats' | 'app'

export const BACKDROP_DIM = 0.4

export const BACKDROP_SCOPES: Record<BackdropScope, string> = { chat: 'This chat', timed: 'For a while', chats: 'All chats', app: 'Whole app' }

export async function setBackdrop(scope: BackdropScope, backdrop: Backdrop | null, sessionId: string | null, minutes?: number): Promise<void> {
  if (scope === 'app') return void (await useApp.getState().updateSettings({ backdrop }))
  if (scope === 'chats') return void (await useApp.getState().updateSettings({ chatBackdrop: backdrop }))
  if (!sessionId) throw new Error('Open a chat first; this chat’s background belongs to it.')
  await engine('backdrop.set', { sessionId, scope, backdrop, minutes })
}
