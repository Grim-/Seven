import type { KeyboardEvent, MouseEvent } from 'react'
import { Plus } from 'lucide-react'
import { formatRelative } from '../../../lib/format'
import { UP_DOWN, stepByKey } from '../../../lib/stepKeys'
import { rowMenu } from '../../../views/data/entryMenu'
import { ListRow, openMenu } from '../../ui'
import { LiveAvatar } from '../LiveAvatar'
import { copyAvatarItem } from './avatarActions'
import { NEW_AVATAR, type AvatarDraftState } from './useAvatarDraft'

export function AvatarList({ studio, onNew, onPicked }: { studio: AvatarDraftState; onNew: () => void; onPicked: () => void }) {
  const { list, selected } = studio
  const select = (id: string) => {
    studio.select(id)
    onPicked()
  }
  const blankMenu = (e: MouseEvent) => {
    if (e.target === e.currentTarget) openMenu(e, 'Avatars', [{ label: 'New avatar', icon: <Plus />, onSelect: onNew }])
  }
  const keys = (e: KeyboardEvent) => {
    const at = stepByKey(e, list.findIndex((a) => a.id === selected), list.length, UP_DOWN)
    if (at !== null) studio.select(list[at].id)
  }
  return (
    <div onContextMenu={blankMenu} onKeyDown={keys} className="flex h-full min-h-0 flex-col gap-px overflow-y-auto py-1">
      {studio.isNew && studio.preview && <ListRow active onClick={() => select(NEW_AVATAR)} icon={<LiveAvatar avatar={studio.preview} size={24} />} title={studio.draft?.name || 'New avatar'} subtitle="not made yet" tone="tag" />}
      {list.map((a) => (
        <ListRow
          key={a.id}
          active={selected === a.id}
          onClick={() => select(a.id)}
          onMenu={rowMenu('avatar', a.id, a.name, () => select(a.id), [copyAvatarItem(studio, a)])}
          icon={<LiveAvatar avatar={a} size={24} />}
          title={a.name}
          subtitle={a.builtin ? 'built in' : formatRelative(a.updatedAt)}
          tone="tag"
        />
      ))}
    </div>
  )
}
