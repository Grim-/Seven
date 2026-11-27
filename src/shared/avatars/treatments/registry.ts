import { pickSettings, settingsFor, type SettingSpec, type SettingValues } from '../../settingSpec'
import { AVATAR_SIZES, POSE_KEYS, type AvatarSize } from '../basics'

export interface TreatmentEntry {
  key: string
  type: string
  settings: SettingValues
  poses: Record<string, SettingValues>
}

export interface AvatarTreatmentInfo {
  id: string
  label: string
  description: string
  settings: SettingSpec[]
  poseSettings: string[]
  animates: boolean
  bleed: number
  from?: AvatarSize
}

export const BLEND_MODES: { value: string; label: string; op: string }[] = [
  { value: 'normal', label: 'Normal', op: 'source-over' },
  { value: 'screen', label: 'Screen', op: 'screen' },
  { value: 'add', label: 'Add', op: 'lighter' }
]

export const TREATMENT_ON: SettingSpec = { name: 'on', label: 'On', type: 'toggle', default: true }

const MAX_TREATMENTS = 12
const KEY = /^[a-z0-9]{1,16}$/

function commonSettings(from: AvatarSize): SettingSpec[] {
  return [
    TREATMENT_ON,
    { name: 'mix', label: 'Mix', type: 'range', min: 0, max: 1, step: 0.05, default: 1 },
    { name: 'blend', label: 'Blend', type: 'choice', options: BLEND_MODES.map(({ value, label }) => ({ value, label })), default: 'normal' },
    { name: 'reacts', label: 'Reacts to mood', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    { name: 'from', label: 'Shows from', type: 'choice', options: AVATAR_SIZES.map((s) => ({ value: s.size, label: s.label })), default: from }
  ]
}

const COMMON_POSED = ['on', 'mix', 'blend', 'reacts']

const treatments = new Map<string, AvatarTreatmentInfo>()

export function registerAvatarTreatment(info: AvatarTreatmentInfo): void {
  treatments.set(info.id, {
    ...info,
    settings: [...info.settings, ...commonSettings(info.from ?? 'badge')],
    poseSettings: [...new Set([...info.poseSettings, ...COMMON_POSED])]
  })
}

export function avatarTreatments(): AvatarTreatmentInfo[] {
  return [...treatments.values()]
}

export function avatarTreatmentInfo(id: string | null | undefined): AvatarTreatmentInfo | null {
  return (id && treatments.get(id)) || null
}

export function newTreatmentKey(taken: Iterable<string>): string {
  const used = new Set(taken)
  let n = used.size
  while (used.has(`t${n.toString(36)}`)) n++
  return `t${n.toString(36)}`
}

export function newTreatment(type: string, taken: Iterable<string>): TreatmentEntry | null {
  const info = avatarTreatmentInfo(type)
  return info ? { key: newTreatmentKey(taken), type: info.id, settings: settingsFor(info.settings, {}), poses: {} } : null
}

export function stackBleed(entries: TreatmentEntry[] | undefined): number {
  return Math.max(0, ...(entries ?? []).map((e) => avatarTreatmentInfo(e.type)?.bleed ?? 0))
}

function cleanTreatmentPoses(info: AvatarTreatmentInfo, value: unknown): Record<string, SettingValues> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const v = value as Record<string, unknown>
  const out: Record<string, SettingValues> = {}
  for (const key of POSE_KEYS) {
    const picked = pickSettings(info.settings, v[key], info.poseSettings)
    if (Object.keys(picked).length) out[key] = picked
  }
  return out
}

export function cleanTreatments(value: unknown): TreatmentEntry[] {
  if (!Array.isArray(value)) return []
  const out: TreatmentEntry[] = []
  const keys = new Set<string>()
  for (const raw of value.slice(0, MAX_TREATMENTS)) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const info = avatarTreatmentInfo(typeof r.type === 'string' ? r.type : null)
    if (!info) continue
    const key = typeof r.key === 'string' && KEY.test(r.key) && !keys.has(r.key) ? r.key : newTreatmentKey(keys)
    keys.add(key)
    const settings = r.settings && typeof r.settings === 'object' && !Array.isArray(r.settings) ? (r.settings as Record<string, unknown>) : {}
    out.push({ key, type: info.id, settings: settingsFor(info.settings, settings), poses: cleanTreatmentPoses(info, r.poses) })
  }
  return out
}
