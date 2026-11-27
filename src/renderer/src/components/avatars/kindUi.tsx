import { avatarRendererInfo, type Avatar } from '@shared/avatars'
import { ACTIVITIES, MOODS } from '@shared/moods'
import { Markdown } from '../chat/Markdown'
import { EmptyState } from '../ui'
import { EntryCard, Facts } from '../entries/EntryCard'
import { useAvatars } from '../../store/avatars'
import { registerKindUi, SETUP_GROUP, type EntrySurfaceProps } from '../../registries/kinds'
import { entryWidget } from '../../registries/widgets'
import { LiveAvatar } from './LiveAvatar'
import { AvatarsPanel, NEW_AVATAR } from './studio/AvatarsPanel'
import { panelScreen } from '../data/panelScreen'

const POSE_LABELS = new Map<string, string>([...MOODS.map((m) => [m.name, m.label] as const), ...ACTIVITIES.map((a) => [a.name, a.label] as const)])

function useAvatarEntry(id: string): Avatar | undefined {
  return useAvatars((s) => s.list.find((a) => a.id === id))
}

function AvatarChat({ id }: EntrySurfaceProps) {
  const avatar = useAvatarEntry(id)
  if (!avatar) return <EmptyState title="Removed">This avatar no longer exists.</EmptyState>
  const poses = Object.keys(avatar.poses).map((p) => POSE_LABELS.get(p) ?? p)
  return (
    <EntryCard title={avatar.name} tag="avatar">
      <div className="grid grid-cols-[96px_1fr] gap-3">
        <LiveAvatar avatar={avatar} className="h-24 w-24" />
        <Facts rows={[['Drawn by', avatarRendererInfo(avatar.renderer)?.label ?? avatar.renderer], ['Own looks', poses.length ? poses.join(', ') : 'none'], ['Kind', avatar.builtin ? 'built in' : 'yours']]} />
      </div>
      {avatar.description && <Markdown text={avatar.description} className="text-[12.5px] text-dim" />}
    </EntryCard>
  )
}

function AvatarWidget({ id }: EntrySurfaceProps) {
  const avatar = useAvatarEntry(id)
  return avatar ? <LiveAvatar avatar={avatar} className="h-full min-h-16 w-full" /> : null
}

function AvatarStage({ id }: EntrySurfaceProps) {
  const avatar = useAvatarEntry(id)
  if (!avatar) return null
  return (
    <div className="flex h-[70vh] flex-col gap-3">
      <LiveAvatar avatar={avatar} className="min-h-0 w-full flex-1" />
      <div className="font-label text-[13px] caps-20 text-accent">{avatar.name}</div>
    </div>
  )
}

function AvatarThumb({ id }: { id: string }) {
  const avatar = useAvatarEntry(id)
  return avatar ? <LiveAvatar avatar={avatar} className="h-full w-full" /> : null
}

registerKindUi('avatar', {
  railGroup: SETUP_GROUP,
  present: { Screen: panelScreen(AvatarsPanel), Chat: AvatarChat, Stage: AvatarStage, Widget: entryWidget(AvatarWidget), Thumb: AvatarThumb },
  whole: true,
  addLabel: 'New avatar',
  add: (_k, select) => () => select({ kind: 'avatar', id: NEW_AVATAR })
})
