import { useState } from 'react'
import { avatarRendererInfo } from '@shared/avatars'
import type { SettingValue, SettingValues } from '@shared/settingSpec'
import type { AvatarDraft } from './useAvatarDraft'
import { BASE_POSE, withPose } from './poses'

export function usePoseLook(draft: AvatarDraft | null, set: (patch: Partial<AvatarDraft>) => void) {
  const [editing, edit] = useState(BASE_POSE)
  const info = draft ? avatarRendererInfo(draft.renderer) : null
  const posed = editing !== BASE_POSE
  const treatments = draft?.treatments ?? []
  const marked = draft ? [...new Set([...Object.keys(draft.poses), ...treatments.flatMap((t) => Object.keys(t.poses))])] : []
  const own: SettingValues = (posed && draft?.poses[editing]) || {}
  const specs = info ? (posed ? info.settings.filter((s) => info.poseSettings.includes(s.name)) : info.settings) : []
  const values: SettingValues = draft ? { ...draft.settings, ...own } : {}

  const change = (name: string, value: SettingValue) => {
    if (!draft) return
    if (posed) set({ poses: { ...draft.poses, [editing]: { ...own, [name]: value } } })
    else set({ settings: { ...draft.settings, [name]: value } })
  }
  const reset = (name: string) => {
    if (!draft) return
    const { [name]: _gone, ...rest } = own
    set({ poses: withPose(draft.poses, editing, rest) })
  }
  const clear = (key: string) =>
    draft &&
    set({
      poses: withPose(draft.poses, key, {}),
      ...(treatments.length ? { treatments: treatments.map((t) => ({ ...t, poses: withPose(t.poses, key, {}) })) } : {})
    })

  return { editing, edit, posed, marked, specs, values, changed: Object.keys(own), change, reset: posed ? reset : undefined, clear }
}

export type PoseLook = ReturnType<typeof usePoseLook>
