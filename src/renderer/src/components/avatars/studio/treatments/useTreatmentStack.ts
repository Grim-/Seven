import { newTreatment, newTreatmentKey, type TreatmentEntry } from '@shared/avatars'
import type { SettingValue } from '@shared/settingSpec'
import { useViewPlace } from '../../../../lib/viewPlace'
import { moved } from '../../../ui'
import { BASE_POSE, withPose } from '../poses'

export function useTreatmentStack(entries: TreatmentEntry[], onChange: (next: TreatmentEntry[]) => void, editing: string) {
  const [picked, pick] = useViewPlace<string | null>('avatarStudio.treatment', null)
  const posed = editing !== BASE_POSE
  const index = (key: string) => entries.findIndex((e) => e.key === key)
  const current = entries.find((e) => e.key === picked) ?? null
  const replace = (key: string, change: (e: TreatmentEntry) => TreatmentEntry) => onChange(entries.map((e) => (e.key === key ? change(e) : e)))
  const insert = (entry: TreatmentEntry, at: number) => {
    onChange([...entries.slice(0, at), entry, ...entries.slice(at)])
    pick(entry.key)
  }

  const add = (type: string) => {
    const entry = newTreatment(type, entries.map((e) => e.key))
    if (entry) insert(entry, current ? index(current.key) + 1 : entries.length)
  }
  const duplicate = (key: string) => {
    const from = entries[index(key)]
    if (from) insert({ ...structuredClone(from), key: newTreatmentKey(entries.map((e) => e.key)) }, index(key) + 1)
  }
  const reorder = (from: number, to: number) => onChange(moved(entries, from, to))
  const move = (key: string, by: number) => reorder(index(key), index(key) + by)
  const remove = (key: string) => onChange(entries.filter((e) => e.key !== key))

  const valuesOf = (e: TreatmentEntry) => (posed ? { ...e.settings, ...e.poses[editing] } : e.settings)
  const changedOf = (e: TreatmentEntry) => (posed ? Object.keys(e.poses[editing] ?? {}) : [])
  const overridden = (e: TreatmentEntry) => posed && Boolean(e.poses[editing])
  const change = (key: string, name: string, value: SettingValue) =>
    replace(key, (e) => (posed ? { ...e, poses: { ...e.poses, [editing]: { ...e.poses[editing], [name]: value } } } : { ...e, settings: { ...e.settings, [name]: value } }))
  const reset = (key: string, name: string) =>
    replace(key, (e) => {
      const { [name]: _gone, ...rest } = e.poses[editing] ?? {}
      return { ...e, poses: withPose(e.poses, editing, rest) }
    })
  const clearPose = (key: string) => replace(key, (e) => ({ ...e, poses: withPose(e.poses, editing, {}) }))

  return { entries, picked: current?.key ?? null, pick, posed, add, duplicate, reorder, move, remove, valuesOf, changedOf, overridden, change, reset: posed ? reset : undefined, clearPose }
}

export type TreatmentStackState = ReturnType<typeof useTreatmentStack>
