import { create } from 'zustand'

export interface ToolDraft {
  callIndex: number
  name: string
  text: string
  done: boolean
}

interface DraftState {
  drafts: Record<string, ToolDraft>
  chunk: (messageId: string, callIndex: number, name: string, chunk: string, done: boolean) => void
  clear: (messageId: string, name?: string) => void
}

export const useDrafts = create<DraftState>((set) => ({
  drafts: {},
  chunk: (messageId, callIndex, name, chunk, done) =>
    set((s) => {
      const prev = s.drafts[messageId]
      const text = prev && prev.callIndex === callIndex ? prev.text + chunk : chunk
      return { drafts: { ...s.drafts, [messageId]: { callIndex, name, text, done } } }
    }),
  clear: (messageId, name) =>
    set((s) => {
      const d = s.drafts[messageId]
      if (!d || (name && d.name !== name)) return s
      const drafts = { ...s.drafts }
      delete drafts[messageId]
      return { drafts }
    })
}))
