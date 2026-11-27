import { useEffect, useRef, useState } from 'react'
import { ACTIVITIES, MOOD_NAMES, NEUTRAL_MOOD, REACTION_POSES, isReactionPose, moodDef, nearestMood, poseOf, type Activity, type AvatarPose, type MoodName } from '@shared/moods'
import { triggerVfx } from '../../../store/vfx'
import type { Dials } from './MoodPad'

const REACTION_MS = 1500

export const REST_ACTIVITY: Activity = 'idle'

export function useStagePreview(target: string | null, editing: string) {
  const [activity, setActivity] = useState<Activity>(REST_ACTIVITY)
  const [dials, setDials] = useState<Dials | null>(null)
  const [reaction, setReaction] = useState<string | null>(null)
  const timer = useRef<number | null>(null)
  const stopTimer = () => {
    if (timer.current) window.clearTimeout(timer.current)
  }
  useEffect(() => stopTimer, [])

  const show = (key: string) => {
    stopTimer()
    setReaction(null)
    const p = poseOf(key)
    const def = moodDef(p?.mood)
    setDials(def && def.name !== NEUTRAL_MOOD ? { energy: def.energy, warmth: def.warmth } : null)
    setActivity(p?.activity ?? REST_ACTIVITY)
  }
  const react = (name: string) => {
    stopTimer()
    setReaction(name)
    const cue = REACTION_POSES.find((r) => r.name === name)?.vfx
    if (target && cue) triggerVfx(target, cue)
    timer.current = window.setTimeout(() => setReaction(null), REACTION_MS)
  }
  const effect = (preset: string) => {
    if (target) triggerVfx(target, { preset })
  }

  const pose: AvatarPose = {
    ...(dials ? { mood: nearestMood(dials.energy, dials.warmth, MOOD_NAMES) as MoodName, ...dials } : {}),
    activity,
    reaction: (isReactionPose(editing) ? editing : reaction) || null,
    rate: ACTIVITIES.find((a) => a.name === activity)?.previewRate
  }

  return { pose, activity, setActivity, dials, setDials, show, react, effect }
}

export type StagePreview = ReturnType<typeof useStagePreview>
