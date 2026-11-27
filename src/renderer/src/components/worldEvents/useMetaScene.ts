import { useEffect } from 'react'
import type { ChatMessage } from '@shared/types'
import { engine } from '../../lib/ipc'
import { openChat } from '../../lib/conversation'
import { failed } from '../../lib/notify'
import { useSessions } from '../../store/sessions'

const EMPTY_MESSAGES: ChatMessage[] = []

/** Open (or create and open) the meta-narrative chat session for a world event in the main Chat view. */
export async function openMetaScene(worldId: string | null, eventId: string): Promise<string> {
  const existing = useSessions.getState().list.find((x) => x.scene?.mode === 'meta' && x.scene.eventId === eventId)
  if (existing) {
    openChat(existing.id)
    return existing.id
  }
  const meta = await engine('sessions.startMetaScene', { worldId: worldId ?? '', eventId })
  await useSessions.getState().refresh([meta.id])
  await useSessions.getState().load(meta.id)
  openChat(meta.id)
  return meta.id
}

export function useMetaScene(worldId: string | null, eventId: string, sessionId?: string | null) {
  const session = useSessions((s) =>
    sessionId
      ? (s.list.find((x) => x.id === sessionId) ?? null)
      : (s.list.find((x) => x.scene?.mode === 'meta' && x.scene.eventId === eventId) ?? null)
  )
  const id = session?.id ?? null
  const messages = useSessions((s) => (id ? (s.messages[id] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES))
  const running = useSessions((s) => (id ? Boolean(s.running[id]) : false))

  useEffect(() => {
    if (id) void useSessions.getState().load(id).catch(failed('Could not load the scene'))
  }, [id])

  const send = (text: string) => {
    if (id) void engine('sessions.send', { id, text }).catch(failed('Could not send to the scene'))
  }

  const begin = async (agentId: string, text: string) => {
    if (id) {
      await engine('sessions.send', { id, text })
      return
    }
    const meta = await engine('sessions.startMetaScene', { worldId: worldId ?? '', eventId, agentId })
    await useSessions.getState().refresh([meta.id])
    await useSessions.getState().load(meta.id)
    await engine('sessions.send', { id: meta.id, text })
  }

  const stop = () => {
    if (id) void engine('sessions.abort', { id }).catch(failed('Could not stop the scene'))
  }

  return { session, messages, running, send, begin, stop }
}
