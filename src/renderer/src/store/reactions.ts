import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { REACTIONS, type AgentReaction, type AvatarState } from '@shared/types'
import { useSessions } from './sessions'

interface Mood {
  state: AvatarState
  until: number
}

export interface Bubble {
  id: number
  emoji: string
  until: number
}

interface ReactionsState {
  moods: Record<string, Mood>
  bubbles: Record<string, Bubble[]>
  failed: Record<string, number>
  onReaction: (r: AgentReaction) => void
  onFailed: (sessionId: string) => void
  prune: () => void
}

let nextBubble = 1

const ERROR_MS = 5000

export const useReactions = create<ReactionsState>((set, get) => ({
  moods: {},
  bubbles: {},
  failed: {},
  onReaction: ({ sessionId, state, reaction, seconds }) => {
    const until = Date.now() + seconds * 1000
    set((s) => ({
      moods: state ? { ...s.moods, [sessionId]: { state, until } } : s.moods,
      bubbles:
        reaction && REACTIONS[reaction]
          ? { ...s.bubbles, [sessionId]: [...(s.bubbles[sessionId] ?? []), { id: nextBubble++, emoji: REACTIONS[reaction], until: Date.now() + Math.min(seconds, 4) * 1000 }] }
          : s.bubbles
    }))
    setTimeout(() => get().prune(), seconds * 1000 + 50)
  },
  onFailed: (sessionId) => {
    set((s) => ({ failed: { ...s.failed, [sessionId]: Date.now() + ERROR_MS } }))
    setTimeout(() => get().prune(), ERROR_MS + 50)
  },
  prune: () => {
    const now = Date.now()
    set((s) => ({
      moods: Object.fromEntries(Object.entries(s.moods).filter(([, m]) => m.until > now)),
      bubbles: Object.fromEntries(
        Object.entries(s.bubbles)
          .map(([k, list]) => [k, list.filter((b) => b.until > now)] as const)
          .filter(([, list]) => list.length)
      ),
      failed: Object.fromEntries(Object.entries(s.failed).filter(([, t]) => t > now))
    }))
  }
}))

function streamState(sessionId: string | null): AvatarState | null {
  if (!sessionId) return null
  const s = useSessions.getState()
  if (!s.running[sessionId]) return null
  const last = s.messages[sessionId]?.at(-1)
  if (!last || last.role !== 'assistant') return 'thinking'
  const part = last.parts.at(-1)
  if (!part || part.type === 'thought' || (part.type === 'tool' && part.status === 'running')) return 'thinking'
  if (part.type === 'text') return 'talking'
  return 'thinking'
}

export function useAvatarState(sessionId: string | null): AvatarState {
  const mood = useReactions((s) => (sessionId ? s.moods[sessionId] : undefined))
  const failed = useReactions((s) => (sessionId ? s.failed[sessionId] : undefined))
  const stream = useSessions(() => streamState(sessionId))
  const [, setNow] = useState(0)
  const now = Date.now()
  useEffect(() => {
    const ends = [mood?.until, failed].filter((t): t is number => !!t && t > Date.now())
    if (!ends.length) return
    const timer = setTimeout(() => setNow(Date.now()), Math.min(...ends) - Date.now() + 20)
    return () => clearTimeout(timer)
  }, [mood, failed])
  if (mood && mood.until > now) return mood.state
  if (stream) return stream
  if (failed && failed > now) return 'error'
  return 'idle'
}

export function useBubbles(sessionId: string | null): Bubble[] {
  return useReactions((s) => (sessionId ? (s.bubbles[sessionId] ?? EMPTY) : EMPTY))
}

const EMPTY: Bubble[] = []
