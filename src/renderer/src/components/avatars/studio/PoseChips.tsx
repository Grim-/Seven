import type { MouseEvent } from 'react'
import { POSE_OPTIONS } from '@shared/moods'
import { Segmented, openMenu } from '../../ui'

export const BASE_POSE = ''

const OPTIONS = [{ value: BASE_POSE, label: 'Base' }, ...POSE_OPTIONS]

export function poseLabel(key: string): string {
  return OPTIONS.find((p) => p.value === key)?.label ?? key
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

export function PoseChips({ value, ...actions }: { value: string } & PoseActions) {
  return <Segmented value={value} options={OPTIONS} onChange={actions.onPick} marked={actions.marked} onMenu={(e, key) => openPoseMenu(e, key, actions)} wrap />
}
