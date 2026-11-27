import { isAssetId } from '../ids'
import { pickSettings, settingsFor, type SettingSpec, type SettingValues } from '../settingSpec'
import type { AvatarRef } from '../types'
import { POSE_KEYS, type AvatarSize } from './basics'
import { cleanTreatments, type TreatmentEntry } from './treatments'

export { AVATAR_SIZES, POSE_KEYS, avatarSizeOf, sizeRank, type AvatarSize } from './basics'

export interface Avatar {
  id: string
  name: string
  description: string
  renderer: string
  settings: SettingValues
  poses: Record<string, SettingValues>
  treatments?: TreatmentEntry[]
  builtin?: boolean
  createdBy?: string | null
  createdAt: number
  updatedAt: number
}

export type AvatarInput = Partial<Omit<Avatar, 'id'>> & { id?: string | null }

export interface AvatarSeed {
  id: string
  name: string
  description: string
  settings?: SettingValues
  poses?: Record<string, SettingValues>
  treatments?: unknown[]
}

export interface AvatarRendererInfo {
  id: string
  label: string
  description: string
  settings: SettingSpec[]
  poseSettings: string[]
  stillAt: AvatarSize[]
  builtins: AvatarSeed[]
}

export const MEDIA_CLIP_SETTING: SettingSpec = { name: 'picture', label: 'Fallback clip', type: 'picture', group: 'look', default: '' }

const renderers = new Map<string, AvatarRendererInfo>()

export function registerAvatarRenderer(info: AvatarRendererInfo): void {
  const hasMedia = info.settings.some((s) => s.name === 'picture')
  const normalized: AvatarRendererInfo = hasMedia
    ? info
    : {
        ...info,
        settings: [...info.settings, MEDIA_CLIP_SETTING],
        poseSettings: [...new Set([...info.poseSettings, 'picture'])]
      }
  renderers.set(info.id, normalized)
}

export function avatarRenderers(): AvatarRendererInfo[] {
  return [...renderers.values()]
}

export function avatarRendererInfo(id: string | null | undefined): AvatarRendererInfo | null {
  return (id && renderers.get(id)) || null
}

function cleanPoses(info: AvatarRendererInfo, value: unknown): Record<string, SettingValues> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const v = value as Record<string, unknown>
  const out: Record<string, SettingValues> = {}
  for (const key of POSE_KEYS) {
    const picked = pickSettings(info.settings, v[key], info.poseSettings)
    if (Object.keys(picked).length) out[key] = picked
  }
  return out
}

export function builtinAvatars(): Avatar[] {
  return avatarRenderers().flatMap((info) =>
    info.builtins.map((seed) => ({
      id: seed.id,
      name: seed.name,
      description: seed.description,
      renderer: info.id,
      settings: settingsFor(info.settings, seed.settings),
      poses: cleanPoses(info, seed.poses),
      ...withTreatments(cleanTreatments(seed.treatments)),
      builtin: true,
      createdBy: null,
      createdAt: 0,
      updatedAt: 0
    }))
  )
}

export function cleanAvatar(input: AvatarInput, base: Avatar | null): Omit<Avatar, 'id' | 'createdAt' | 'updatedAt' | 'builtin'> {
  const renderer = input.renderer ?? base?.renderer ?? ''
  const info = avatarRendererInfo(renderer)
  if (!info) throw new Error(`No avatar renderer "${renderer}". Renderers: ${avatarRenderers().map((r) => r.id).join(', ')}`)
  const kept = base && base.renderer === renderer ? base : null
  return {
    name: String(input.name ?? base?.name ?? '').trim().slice(0, 60),
    description: String(input.description ?? base?.description ?? '').trim().slice(0, 400),
    renderer,
    settings: settingsFor(info.settings, { ...(base?.settings ?? {}), ...(input.settings ?? {}) }),
    poses: cleanPoses(info, input.poses ?? kept?.poses ?? {}),
    ...withTreatments(cleanTreatments(input.treatments ?? base?.treatments)),
    createdBy: input.createdBy ?? base?.createdBy ?? null
  }
}

function withTreatments(treatments: TreatmentEntry[]): { treatments?: TreatmentEntry[] } {
  return treatments.length ? { treatments } : {}
}

const CODED_TYPE = /^[a-z][a-z0-9_-]{0,40}$/
const MAX_ID = 80

export function cleanAvatarRef(value: unknown): AvatarRef | null {
  const a = value as Partial<{ kind: string; assetId: string; type: string; id: string }> | null | undefined
  if (!a || typeof a !== 'object') return null
  if (a.kind === 'avatar' && typeof a.id === 'string' && a.id && a.id.length <= MAX_ID) return { kind: 'avatar', id: a.id }
  if (a.kind === 'file' && typeof a.assetId === 'string' && isAssetId(a.assetId)) return { kind: 'file', assetId: a.assetId }
  if (a.kind === 'coded' && typeof a.type === 'string' && CODED_TYPE.test(a.type)) return { kind: 'coded', type: a.type }
  return null
}
