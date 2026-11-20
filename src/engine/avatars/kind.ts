import { avatarRendererInfo, type Avatar } from '@shared/avatars'
import type { SettingValues } from '@shared/settingSpec'
import { MOODS, ACTIVITIES } from '@shared/moods'
import type { Kind } from '../library/kinds'
import { registerKind } from '../library/kindRegistry'
import { storePacking } from '../library/packing'
import { avatars } from './store'

const POSE_LABELS = new Map<string, string>([...MOODS.map((m) => [m.name, m.label] as const), ...ACTIVITIES.map((a) => [a.name, a.label] as const)])

function avatarLine(a: Avatar): string {
  const renderer = avatarRendererInfo(a.renderer)?.label ?? a.renderer
  const poses = Object.keys(a.poses).map((p) => POSE_LABELS.get(p) ?? p)
  return [a.description || `${renderer} avatar`, poses.length ? `own looks for ${poses.join(', ')}` : ''].filter(Boolean).join('; ')
}

function valuesText(values: SettingValues): string {
  return Object.entries(values)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(', ')
}

function avatarText(a: Avatar): string {
  const renderer = avatarRendererInfo(a.renderer)
  return [
    `# ${a.name}${a.builtin ? ' (built in, read only)' : ''}`,
    a.description,
    `Drawn by ${renderer?.label ?? a.renderer}: ${renderer?.description ?? ''}`,
    `Settings: ${valuesText(a.settings)}`,
    renderer?.poseSettings.length ? `Pose settings: ${renderer.poseSettings.join(', ')}` : '',
    ...Object.entries(a.poses).map(([pose, values]) => `Pose ${pose}: ${valuesText(values)}`)
  ]
    .filter(Boolean)
    .join('\n')
}

export const avatarKind: Kind = {
  ...storePacking({ find: (id) => avatars.find(id), names: () => avatars.list().map((a) => a.name), save: (x) => avatars.save(x), everywhere: (a) => Boolean(a.builtin), drop: ['builtin'] }),
  group: 'Tools',
  kind: 'avatar',
  rename: (id, name) => void avatars.save({ id, name }),
  remove: (id) => avatars.delete(id),
  label: 'Avatar',
  plural: 'Avatars',
  exportable: true,
  export(id) {
    const { id: _id, builtin: _b, createdBy: _c, ...rest } = avatars.get(id)
    return { title: avatars.get(id).name, markdown: avatarText(avatars.get(id)), json: rest }
  },
  icon: 'smile',
  description: 'how agents look: animated faces, glyphs and pictures that react to moods and what the agent is doing',
  parts: [],
  actions: ['create_avatar', 'change_avatar'],
  available: () => true,
  title: (id) => avatars.find(id)?.name ?? id,
  search(query, limit) {
    const q = query.toLowerCase()
    return avatars
      .list()
      .filter((a) => !q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q))
      .slice(0, limit)
      .map((a) => ({ kind: 'avatar', id: a.id, title: a.name, at: a.updatedAt || undefined }))
  },
  line: (id) => {
    const a = avatars.find(id)
    return a ? avatarLine(a) : ''
  },
  card: (id) => avatarText(avatars.get(id)),
  resolve: (ref) => avatars.find(ref)?.id ?? null,
  full: (id) => avatarText(avatars.get(id))
}

registerKind(250, avatarKind)
