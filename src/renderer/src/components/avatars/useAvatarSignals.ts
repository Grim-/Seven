import { useEffect, useState } from 'react'
import type { AvatarPose } from '@shared/moods'
import { useActivity, useAvatarMood, spokenLength } from '../../store/reactions'
import { useSessions } from '../../store/sessions'
import { SignalSource } from './signals'

export function useAvatarSignals(sessionId: string | null, pose: AvatarPose | undefined): SignalSource {
  const [source] = useState(() => new SignalSource())
  const mood = useAvatarMood(sessionId)
  const activity = useActivity(sessionId)

  const energy = pose?.energy
  const warmth = pose?.warmth
  useEffect(() => source.setMood(pose?.mood ?? mood, energy !== undefined && warmth !== undefined ? { energy, warmth } : undefined), [source, pose?.mood, mood, energy, warmth])
  useEffect(() => source.setRate(pose?.rate ?? null), [source, pose?.rate])
  useEffect(() => source.setActivity(pose?.activity ?? activity), [source, pose?.activity, activity])

  useEffect(() => {
    if (!sessionId) return
    source.noteSpoken(spokenLength(sessionId))
    return useSessions.subscribe(() => source.noteSpoken(spokenLength(sessionId)))
  }, [source, sessionId])

  return source
}
