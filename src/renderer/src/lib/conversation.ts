import { useEffect, useMemo } from 'react'
import { useWindows, windowsOf } from '../store/windows'
import { useSessions, draftOf } from '../store/sessions'
import { useApp } from '../store/app'
import { useWindowId } from './window'
import { failed } from './notify'
import { queueComposer } from './composer'
import { engine } from './ipc'

export interface Conversation {
  key: string
  sessionId: string | null
  go: (sessionId: string | null) => void
}

function sessionAt(location: unknown): string | null {
  return typeof location === 'string' ? location : null
}

export function conversationOf(windowId: string): Conversation {
  return {
    key: windowId,
    sessionId: sessionAt(useWindows.getState().locations[windowId]),
    go: (sessionId) => useWindows.getState().set(windowId, sessionId)
  }
}

function useConversationAt(windowId: string | null): Conversation | null {
  const sessionId = useWindows((s) => (windowId ? sessionAt(s.locations[windowId]) : null))
  return useMemo(() => (windowId ? { key: windowId, sessionId, go: (next: string | null) => useWindows.getState().set(windowId, next) } : null), [windowId, sessionId])
}

export function useConversation(): Conversation {
  return useConversationAt(useWindowId())!
}

export function focusedConversation(): Conversation | null {
  const id = useWindows.getState().chat
  return id ? conversationOf(id) : null
}

export function useFocusedConversation(): Conversation | null {
  return useConversationAt(useWindows((s) => s.chat))
}

export function openConversations(): Conversation[] {
  return windowsOf('chats').map(conversationOf)
}

export function useAgentIdOf(conv: Conversation | null): string | null {
  return useSessions((s) => {
    if (!conv) return null
    if (conv.sessionId) return s.list.find((x) => x.id === conv.sessionId)?.agentId ?? null
    return draftOf(s, conv.key).agentId
  })
}

export function recheckOpen(): void {
  for (const conv of openConversations()) void useSessions.getState().recheckContext(conv)
}

export function openChat(sessionId: string | null, agentId?: string): void {
  const home = useWindows.getState().home
  if (!home) return
  const conv = conversationOf(home)
  if (sessionId) conv.go(sessionId)
  else useSessions.getState().startNew(conv, agentId)
  useWindows.getState().focus(home)
  if (home === 'chat') useApp.getState().setView('chat')
}

export function useLoadConversation(): void {
  const conv = useConversation()
  const list = useSessions((s) => s.list)
  useEffect(() => {
    if (conv.sessionId) void useSessions.getState().load(conv.sessionId).catch(failed('Could not open chat'))
    else void useSessions.getState().recheckContext(conv)
  }, [conv.sessionId])
  useEffect(() => {
    if (conv.sessionId && list.length && !list.some((s) => s.id === conv.sessionId)) conv.go(null)
  }, [list, conv.sessionId])
}

export function referenceInChat(link: string): void {
  const home = useWindows.getState().home
  if (!home) return
  queueComposer(home, `${link} `)
  useWindows.getState().focus(home)
  if (home === 'chat') useApp.getState().setView('chat')
}

export function startChatWith(agentId: string, link: string): void {
  const home = useWindows.getState().home
  if (!home) return
  openChat(null, agentId)
  queueComposer(home, `${link} `, true)
}

export function startDmChatWith(agentId: string, link: string): void {
  const home = useWindows.getState().home
  if (!home) return
  void engine('sessions.create', { agentId })
    .then((s) => engine('sessions.setDmMode', { id: s.id, on: true }))
    .then((s) => {
      openChat(s.id)
      queueComposer(home, `${link} `, true)
    })
    .catch(failed('Could not start the DM chat'))
}
