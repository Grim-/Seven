import { POSE_KEYS, avatarRendererInfo, avatarRenderers, type Avatar } from '@shared/avatars'
import { pickSettings, settingsSchema, type SettingValues } from '@shared/settingSpec'
import { avatars } from '../../engine/avatars/store'
import { ToolError, optStr, type ToolDef } from '../../engine/tools/types'

const SETTINGS = { type: ['object', 'null'], properties: settingsSchema(avatarRenderers().flatMap((r) => r.settings)), description: "Setting values; each renderer takes its own (the avatar's card lists them)" }

function objectParam(params: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const v = params[key]
  if (v === null || v === undefined) return null
  if (typeof v !== 'object' || Array.isArray(v)) throw new ToolError(`${key} must be an object of setting names and values`)
  return v as Record<string, unknown>
}

function ignored(avatar: Avatar, given: Record<string, unknown> | null, only?: string[]): string {
  if (!given) return ''
  const info = avatarRendererInfo(avatar.renderer)
  const kept = info ? pickSettings(info.settings, given, only) : {}
  const dropped = Object.keys(given).filter((k) => !(k in kept))
  return dropped.length ? ` Ignored, not ${only ? 'pose settings' : 'settings'} of ${info?.label ?? avatar.renderer}: ${dropped.join(', ')}.` : ''
}

const createAvatar: ToolDef = {
  name: 'create_avatar',
  group: 'look',
  needsWorkspace: false,
  description: `Make a new avatar. Renderers: ${avatarRenderers()
    .map((r) => `${r.id} (${r.description})`)
    .join('; ')}`,
  params: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'A new avatar name' },
      renderer: { enum: avatarRenderers().map((r) => r.id) },
      description: { type: ['string', 'null'] },
      settings: SETTINGS
    }
  },
  async execute(params, ctx) {
    const name = optStr(params, 'name')
    const renderer = optStr(params, 'renderer')
    if (!name || !renderer) throw new ToolError(`Give name and renderer (one of: ${avatarRenderers().map((r) => r.id).join(', ')}).`)
    const taken = avatars.find(name)
    if (taken) throw new ToolError(`There is already an avatar called ${taken.name}. Pick another name, or use change_avatar.`)
    const settings = objectParam(params, 'settings')
    const saved = avatars.save({ id: null, name, renderer, description: optStr(params, 'description') ?? '', settings: (settings ?? {}) as SettingValues, createdBy: ctx.agentId ?? null })
    return `Made avatar ${saved.name}.${ignored(saved, settings)}`
  }
}

const changeAvatar: ToolDef = {
  name: 'change_avatar',
  group: 'look',
  needsWorkspace: false,
  description: 'Change an avatar you or the user made. pose gives it its own look for one mood or activity; clear_pose removes that look.',
  params: {
    type: 'object',
    properties: {
      avatar: { type: 'string', description: 'Avatar name' },
      name: { type: ['string', 'null'], description: 'New name, or null to keep' },
      description: { type: ['string', 'null'] },
      settings: SETTINGS,
      pose: { oneOf: [{ type: 'null' }, { enum: POSE_KEYS }] },
      pose_settings: { ...SETTINGS, description: 'Settings for that pose only' },
      clear_pose: { type: ['boolean', 'null'] }
    }
  },
  async execute(params) {
    const ref = optStr(params, 'avatar')
    const avatar = ref ? avatars.find(ref) : null
    if (!avatar) throw new ToolError(`There is no avatar "${ref ?? ''}". Avatars: ${avatars.list().map((a) => a.name).join(', ')}`)
    const settings = objectParam(params, 'settings')
    const pose = optStr(params, 'pose')
    const poseSettings = objectParam(params, 'pose_settings')
    if ((poseSettings || params.clear_pose === true) && !pose) throw new ToolError(`Set pose to one of: ${POSE_KEYS.join(', ')}.`)
    const poses = { ...avatar.poses }
    if (pose && params.clear_pose === true) delete poses[pose]
    else if (pose && poseSettings) poses[pose] = { ...poses[pose], ...(poseSettings as SettingValues) }
    const saved = avatars.save({ id: avatar.id, name: optStr(params, 'name') ?? undefined, description: optStr(params, 'description') ?? undefined, settings: { ...avatar.settings, ...((settings ?? {}) as SettingValues) }, poses })
    return `Changed avatar ${saved.name}.${ignored(saved, settings)}${ignored(saved, poseSettings, avatarRendererInfo(saved.renderer)?.poseSettings)}`
  }
}

export const AVATAR_TOOLS: ToolDef[] = [createAvatar, changeAvatar]
