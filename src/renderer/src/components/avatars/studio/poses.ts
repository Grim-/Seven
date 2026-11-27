import type { MouseEvent } from 'react'
import type { SettingValues } from '@shared/settingSpec'
import { ACTIVITIES, MOODS, REACTION_POSES, isMood, poseOf, type AvatarPose } from '@shared/moods'
import { openMenu } from '../../ui'

export const BASE_POSE = ''

export interface PoseEntry {
  key: string
  label: string
}

export interface PoseGroup {
  label: string | null
  poses: PoseEntry[]
}

export const POSE_GROUPS: PoseGroup[] = [
  { label: null, poses: [{ key: BASE_POSE, label: 'Base' }] },
  { label: 'Doing', poses: ACTIVITIES.filter((a) => !isMood(a.name)).map((a) => ({ key: a.name, label: a.label })) },
  { label: 'Mood', poses: MOODS.map((m) => ({ key: m.name, label: m.label })) },
  { label: 'Reacting', poses: REACTION_POSES.map((r) => ({ key: r.name, label: r.label })) }
]

export const ALL_POSES: PoseEntry[] = POSE_GROUPS.flatMap((g) => g.poses)

export function poseLabel(key: string): string {
  return ALL_POSES.find((p) => p.key === key)?.label ?? key
}

export function previewPose(key: string): AvatarPose {
  const pose: AvatarPose = poseOf(key) ?? {}
  return { ...pose, rate: ACTIVITIES.find((a) => a.name === pose.activity)?.previewRate }
}

export interface PoseActions {
  marked: string[]
  onPick: (key: string) => void
  onClear: (key: string) => void
  readOnly: boolean
}

export function openPoseMenu(e: MouseEvent, key: string, { marked, onPick, onClear, readOnly }: PoseActions): void {
  openMenu(e, poseLabel(key), [
    { label: 'Edit this look', onSelect: () => onPick(key) },
    { label: 'Clear this look', danger: true, disabled: readOnly || !marked.includes(key), onSelect: () => onClear(key) }
  ])
}

export function withPose(poses: Record<string, SettingValues>, key: string, values: SettingValues): Record<string, SettingValues> {
  const next = { ...poses }
  if (Object.keys(values).length) next[key] = values
  else delete next[key]
  return next
}
