import { create } from 'zustand'
import type { UiRequestState } from '@shared/types'

export const usePlayRequests = create<{ byChat: Record<string, UiRequestState> }>(() => ({ byChat: {} }))

export function showPlayRequest(chat: string, ui: UiRequestState): void {
  usePlayRequests.setState((s) => ({ byChat: { ...s.byChat, [chat]: ui } }))
}

export function hidePlayRequest(chat: string, id: string): void {
  usePlayRequests.setState((s) => {
    if (s.byChat[chat]?.id !== id) return s
    const byChat = { ...s.byChat }
    delete byChat[chat]
    return { byChat }
  })
}
