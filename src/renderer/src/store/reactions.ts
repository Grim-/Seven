import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { REACTIONS, type AgentReaction } from '@shared/types'
import { FAILED_MOOD, type Activity, type MoodName } from '@shared/moods'
import { useSessions } from './sessions'

interface Mood {
  state: MoodName
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

function activityOf(sessionId: string | null): Activity {
  if (!sessionId) return 'idle'
  const s = useSessions.getState()
  if (!s.running[sessionId]) return 'idle'
  const last = s.messages[sessionId]?.at(-1)
  if (!last || last.role !== 'assistant') return 'thinking'
  const part = last.parts.at(-1)
  if (part?.type === 'tool' && part.status === 'running') return 'tool'
  if (part?.type === 'text') return 'talking'
  return 'thinking'
}

export function useActivity(sessionId: string | null): Activity {
  return useSessions(() => activityOf(sessionId))
}

export function spokenLength(sessionId: string): number {
  const last = useSessions.getState().messages[sessionId]?.at(-1)
  if (!last || last.role !== 'assistant') return 0
  const part = last.parts.at(-1)
  return part?.type === 'text' ? part.text.length : 0
}

export function useAvatarMood(sessionId: string | null): MoodName | null {
  const mood = useReactions((s) => (sessionId ? s.moods[sessionId] : undefined))
  const failed = useReactions((s) => (sessionId ? s.failed[sessionId] : undefined))
  const [, setNow] = useState(0)
  const now = Date.now()
  useEffect(() => {
    const ends = [mood?.until, failed].filter((t): t is number => !!t && t > Date.now())
    if (!ends.length) return
    const timer = setTimeout(() => setNow(Date.now()), Math.min(...ends) - Date.now() + 20)
    return () => clearTimeout(timer)
  }, [mood, failed])
  if (mood && mood.until > now) return mood.state
  if (failed && failed > now) return FAILED_MOOD
  return null
}

export function useBubbles(sessionId: string | null): Bubble[] {
  return useReactions((s) => (sessionId ? (s.bubbles[sessionId] ?? EMPTY) : EMPTY))
}

const EMPTY: Bubble[] = []
