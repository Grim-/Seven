import { Pencil, SlidersHorizontal } from 'lucide-react'
import { PICTURE_RENDERER, avatarIdOfRef, fileOfRef } from '@shared/avatars'
import type { AvatarRef, ImagePromptContext } from '@shared/types'
import { engine } from '../../lib/ipc'
import { openEntry } from '../../lib/library'
import { failed } from '../../lib/notify'
import { cn } from '../../lib/cn'
import { useAvatars } from '../../store/avatars'
import { useData } from '../../store/data'
import { Button } from '../ui'
import { PictureField } from '../pictures/PictureField'
import { MEDIA_OPTIONS } from '../pictures/mediaOptions'
import { LiveAvatar } from '../avatars/LiveAvatar'

const TILE = 44

export function AvatarField({
  value,
  onChange,
  context
}: {
  value: AvatarRef | null
  onChange: (v: AvatarRef | null) => void
  context?: ImagePromptContext | null
}) {
  const list = useAvatars((s) => s.list)
  const chosen = avatarIdOfRef(value)
  const file = fileOfRef(value)
  const fileName = useData((s) => (file ? s.assets.find((a) => a.id === file)?.name : undefined))
  const editable = () =>
    file &&
    void engine('avatars.save', { id: null, name: fileName?.replace(/\.[^.]+$/, '') || 'Picture avatar', renderer: PICTURE_RENDERER, settings: { picture: file } })
      .then((saved) => onChange({ kind: 'avatar', id: saved.id }))
      .catch(failed('Could not make the avatar'))
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" title="None" onClick={() => onChange(null)} style={{ width: TILE, height: TILE }} className={cn('border font-label text-[10px] caps', !value ? 'border-ink text-ink' : 'border-line text-faint hover:text-ink')}>
          None
        </button>
        {list.map((a) => (
          <button key={a.id} type="button" title={a.name} onClick={() => onChange({ kind: 'avatar', id: a.id })} className={cn('border-2', chosen === a.id ? 'border-ink' : 'border-transparent hover:border-line')}>
            <LiveAvatar avatar={a} size={TILE} />
          </button>
        ))}
      </div>
      <PictureField options={{ ...MEDIA_OPTIONS, what: 'an agent avatar', context }} value={file} onChange={(id) => onChange(id ? { kind: 'file', assetId: id } : null)} />
      <div className="flex flex-wrap gap-1.5">
        {chosen && (
          <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => openEntry('avatar', chosen)}>
            Open in studio
          </Button>
        )}
        {file && (
          <Button size="sm" variant="ghost" icon={<SlidersHorizontal />} onClick={editable}>
            Make it an editable avatar
          </Button>
        )}
      </div>
    </div>
  )
}
