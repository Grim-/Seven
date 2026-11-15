import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { REACTIONS, type AgentReaction } from '@shared/types'
import { FAILED_MOOD, type Activity, type MoodName } from '@shared/moods'
import { usePhases } from './phases'
import { useSessions } from './sessions'
import { triggerVfx, type VfxCue } from './vfx'

interface Mood {
  state: MoodName
  until: number
}

export interface Bubble {
  id: number
  emoji: string
  until: number
}

export interface ReactionCue {
  id: number
  kind: string
  until: number
  label?: string
}

interface ReactionsState {
  moods: Record<string, Mood>
  bubbles: Record<string, Bubble[]>
  cues: Record<string, ReactionCue>
  failed: Record<string, number>
  onReaction: (r: AgentReaction) => void
  trigger: (sessionId: string, kind: string, seconds?: number, label?: string) => void
  onFailed: (sessionId: string) => void
  prune: () => void
}

let nextBubble = 1
let nextCue = 1

const ERROR_MS = 5000

const REACTION_VFX: Record<string, VfxCue> = {
  hit: { preset: 'hit', color: 'alert' },
  crit: { preset: 'hit', color: 'accent', intensity: 1.35 },
  heal: { preset: 'flash', color: 'ok' },
  sparks: { preset: 'pulse', color: 'cyan' },
  lightbulb: { preset: 'glow', color: 'accent' },
  heart: { preset: 'pulse', color: 'accent' },
  thumbs_up: { preset: 'flash', color: 'ok' },
  music: { preset: 'pulse', color: 'purple' },
  fire: { preset: 'hit', color: 'alert' },
  exclaim: { preset: 'wobble', color: 'alert' },
  question: { preset: 'wobble', color: 'cyan' },
  sweat_drop: { preset: 'wobble' },
  sleepy: { preset: 'fadeIn', color: 'purple' }
}

const MOOD_VFX: Record<string, VfxCue> = {
  angry: { preset: 'hit', color: 'alert' },
  fearful: { preset: 'wobble', color: 'alert' },
  excited: { preset: 'pulse', color: 'cyan' },
  happy: { preset: 'pulse', color: 'ok' },
  proud: { preset: 'glow', color: 'accent' },
  playful: { preset: 'wobble', color: 'cyan' },
  nervous: { preset: 'wobble' },
  surprised: { preset: 'flash', color: 'cyan' }
}

export const useReactions = create<ReactionsState>((set, get) => ({
  moods: {},
  bubbles: {},
  cues: {},
  failed: {},
  onReaction: ({ sessionId, state, reaction, seconds }) => {
    const until = Date.now() + seconds * 1000
    const cue = (reaction && REACTION_VFX[reaction]) || (state && MOOD_VFX[state]) || null
    if (cue) triggerVfx(`avatar:${sessionId}`, cue)
    set((s) => ({
      moods: state ? { ...s.moods, [sessionId]: { state, until } } : s.moods,
      cues: reaction ? { ...s.cues, [sessionId]: { id: nextCue++, kind: reaction, until } } : s.cues,
      bubbles:
        reaction && REACTIONS[reaction]
          ? { ...s.bubbles, [sessionId]: [...(s.bubbles[sessionId] ?? []), { id: nextBubble++, emoji: REACTIONS[reaction], until: Date.now() + Math.min(seconds, 4) * 1000 }] }
          : s.bubbles
    }))
    setTimeout(() => get().prune(), seconds * 1000 + 50)
  },
  trigger: (sessionId, kind, seconds = 1.6, label) => {
    const ms = Math.max(200, seconds * 1000)
    const until = Date.now() + ms
    const cue = REACTION_VFX[kind]
    if (cue) triggerVfx(`avatar:${sessionId}`, cue)
    set((s) => ({ cues: { ...s.cues, [sessionId]: { id: nextCue++, kind, until, label } } }))
    setTimeout(() => get().prune(), ms + 50)
  },
  onFailed: (sessionId) => {
    triggerVfx(`avatar:${sessionId}`, { preset: 'glitch', color: 'alert' })
    set((s) => ({
      failed: { ...s.failed, [sessionId]: Date.now() + ERROR_MS },
      cues: { ...s.cues, [sessionId]: { id: nextCue++, kind: 'hit', until: Date.now() + 1200, label: 'Error' } }
    }))
    setTimeout(() => get().prune(), ERROR_MS + 50)
  },
  prune: () => {
    const now = Date.now()
    set((s) => ({
      moods: Object.fromEntries(Object.entries(s.moods).filter(([, m]) => m.until > now)),
      cues: Object.fromEntries(Object.entries(s.cues).filter(([, c]) => c.until > now)),
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

export function useAvatarReaction(sessionId: string | null): ReactionCue | null {
  const cue = useReactions((s) => (sessionId ? s.cues[sessionId] : undefined))
  const [, setNow] = useState(0)
  const now = Date.now()
  useEffect(() => {
    if (!cue || cue.until <= Date.now()) return
    const timer = setTimeout(() => setNow(Date.now()), cue.until - Date.now() + 20)
    return () => clearTimeout(timer)
  }, [cue])
  return cue && cue.until > now ? cue : null
}

export function useActiveTool(sessionId: string | null): { name: string; label: string } | null {
  const messageId = useSessions((s) => {
    if (!sessionId || !s.running[sessionId]) return null
    const last = s.messages[sessionId]?.at(-1)
    return last?.role === 'assistant' ? last.id : null
  })
  const phase = usePhases((s) => (messageId ? s.phases[messageId] : undefined))
  if (!phase || !phase.tool || (phase.kind !== 'tool' && phase.kind !== 'waiting' && phase.kind !== 'reading')) return null
  return { name: phase.tool, label: phase.detail || phase.tool.replace(/_/g, ' ') }
}

const EMPTY: Bubble[] = []
