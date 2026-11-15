import type { Backdrop } from '@shared/types'
import { engine } from '../../lib/ipc'
import { useApp } from '../../store/app'
import { setBoardSurfaceBackdrop } from '../chat/tabletopStore'

export type BackdropScope = 'surface' | 'chat' | 'timed' | 'chats' | 'app'

export const BACKDROP_DIM = 0.4

export const BACKDROP_SCOPES: Record<BackdropScope, string> = { surface: 'This surface', chat: 'This chat', timed: 'For a while', chats: 'All chats', app: 'Whole app' }

export interface SurfaceBackdropTarget {
  dashboardId: string
  surfaceId: string
  label?: string
}

export async function setBackdrop(
  scope: BackdropScope,
  backdrop: Backdrop | null,
  sessionId: string | null,
  minutes?: number,
  surfaceTarget?: SurfaceBackdropTarget | null,
): Promise<void> {
  if (scope === 'surface') {
    if (!surfaceTarget) throw new Error('Open a tabletop surface first; this background belongs to it.')
    setBoardSurfaceBackdrop(surfaceTarget.dashboardId, surfaceTarget.surfaceId, backdrop)
    return
  }
  if (scope === 'app') return void (await useApp.getState().updateSettings({ backdrop }))
  if (scope === 'chats') return void (await useApp.getState().updateSettings({ chatBackdrop: backdrop }))
  if (!sessionId) throw new Error('Open a chat first; this chat’s background belongs to it.')
  await engine('backdrop.set', { sessionId, scope, backdrop, minutes })
}

export async function clearAllBackdrops(sessionId: string | null, surfaceTarget?: SurfaceBackdropTarget | null): Promise<void> {
  if (surfaceTarget) setBoardSurfaceBackdrop(surfaceTarget.dashboardId, surfaceTarget.surfaceId, null)
  if (sessionId) {
    await Promise.all([
      engine('backdrop.set', { sessionId, scope: 'timed', backdrop: null }),
      engine('backdrop.set', { sessionId, scope: 'chat', backdrop: null }),
    ])
  }
  await useApp.getState().updateSettings({ backdrop: null, chatBackdrop: null })
}
