import { create } from 'zustand'
import type { ChatBackdrops } from '@shared/types'
import { engine } from '../lib/ipc'

interface BackdropState {
  chats: Record<string, ChatBackdrops>
  load: (sessionId: string) => Promise<void>
  set: (sessionId: string, state: ChatBackdrops) => void
}

export const useBackdrops = create<BackdropState>((set) => ({
  chats: {},
  load: async (sessionId) => {
    const state = await engine('backdrop.get', { sessionId })
    set((s) => ({ chats: { ...s.chats, [sessionId]: state } }))
  },
  set: (sessionId, state) => set((s) => ({ chats: { ...s.chats, [sessionId]: state } }))
}))
