import { useEffect, useState } from 'react'
import type { AvatarPose } from '@shared/moods'
import { useActiveTool, useActivity, useAvatarMood, useAvatarReaction, spokenLength } from '../../store/reactions'
import { useSessions } from '../../store/sessions'
import { SignalSource } from './signals'

export function useAvatarSignals(sessionId: string | null, pose: AvatarPose | undefined): SignalSource {
  const [source] = useState(() => new SignalSource())
  const mood = useAvatarMood(sessionId)
  const activity = useActivity(sessionId)
  const tool = useActiveTool(sessionId)
  const cue = useAvatarReaction(sessionId)

  const energy = pose?.energy
  const warmth = pose?.warmth
  useEffect(() => source.setMood(pose?.mood ?? mood, energy !== undefined && warmth !== undefined ? { energy, warmth } : undefined), [source, pose?.mood, mood, energy, warmth])
  useEffect(() => source.setRate(pose?.rate ?? null), [source, pose?.rate])
  useEffect(() => source.setActivity(pose?.activity ?? activity), [source, pose?.activity, activity])
  useEffect(() => source.setTool(tool), [source, tool])
  useEffect(() => {
    if (pose?.reaction) source.triggerReaction(pose.reaction)
  }, [source, pose?.reaction])
  useEffect(() => {
    if (!cue) return
    source.triggerReaction(cue.kind, Math.max(250, cue.until - Date.now()), cue.label ? { label: cue.label } : undefined)
  }, [source, cue?.id])

  useEffect(() => {
    if (!sessionId) return
    source.noteSpoken(spokenLength(sessionId))
    return useSessions.subscribe(() => source.noteSpoken(spokenLength(sessionId)))
  }, [source, sessionId])

  return source
}
