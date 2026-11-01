import { create } from 'zustand'
import type { CommandInfo } from '@shared/types'
import { engine } from '../lib/ipc'
import { errorText } from '../lib/format'
import { draftOf, useSessions } from './sessions'
import type { Conversation } from '../lib/conversation'

export interface CommandOutput {
  sessionId: string | null
  line: string
  text: string | null
  error: boolean
  busy: boolean
}

interface CommandsState {
  list: CommandInfo[]
  output: CommandOutput | null
  load: (conv: Conversation | null) => Promise<void>
  run: (conv: Conversation, line: string) => Promise<void>
  dismiss: () => void
}

export const useCommands = create<CommandsState>((set, get) => ({
  list: [],
  output: null,

  load: async (conv) => {
    const agentId = draftOf(useSessions.getState(), conv?.key ?? '').agentId
    const list = await engine('commands.list', { sessionId: conv?.sessionId ?? null, agentId }).catch(() => null)
    if (list) set({ list })
  },

  run: async (conv, line) => {
    const sessions = useSessions.getState()
    const agentId = draftOf(sessions, conv.key).agentId
    const name = /^\/(\S+)/.exec(line)?.[1]?.toLowerCase()
    const info = get().list.find((c) => c.name.toLowerCase() === name)
    const sessionId = info?.needsChat ? await sessions.ensureSession(conv) : conv.sessionId
    set({ output: { sessionId, line, text: null, error: false, busy: true } })
    try {
      const result = await engine('commands.run', { sessionId, agentId, line })
      set({ output: result.text ? { sessionId, line, text: result.text, error: false, busy: false } : null })
      if (result.openSession) conv.go(result.openSession)
    } catch (err) {
      set({ output: { sessionId, line, text: errorText(err), error: true, busy: false } })
    }
  },

  dismiss: () => set({ output: null })
}))
