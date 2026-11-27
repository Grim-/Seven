import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import { avatarTreatments, newTreatment, type Avatar } from '@shared/avatars'
import { Popover } from '../../../ui'
import { LiveAvatar } from '../../LiveAvatar'
import { wearing } from './thumb'

function PickerChoice({ avatar, type, label, hint, onPick }: { avatar: Avatar; type: string; label: string; hint: string; onPick: () => void }) {
  const preview = useMemo(() => {
    const entry = newTreatment(type, [])
    return entry ? wearing(avatar, { ...entry, key: `pick${type}` }) : avatar
  }, [avatar, type])
  return (
    <button type="button" title={hint} onClick={onPick} className="flex flex-col items-center gap-1.5 p-2 hover:bg-ink/[0.05]">
      <LiveAvatar avatar={preview} size={56} target={`studio-pick:${type}`} />
      <span className="text-[11.5px] text-dim">{label}</span>
    </button>
  )
}

export function TreatmentPicker({ avatar, onAdd }: { avatar: Avatar; onAdd: (type: string) => void }) {
  return (
    <Popover
      title="Add a treatment"
      align="start"
      trigger={
        <span className="flex items-center gap-1.5 px-2 py-1.5 font-label text-[11px] caps-10 text-dim hover:text-accent">
          <Plus className="h-3.5 w-3.5" />
          Add
        </span>
      }
      className="grid grid-cols-3 gap-1 p-2"
    >
      {(close) =>
        avatarTreatments().map((info) => (
          <PickerChoice
            key={info.id}
            avatar={avatar}
            type={info.id}
            label={info.label}
            hint={info.description}
            onPick={() => {
              close()
              onAdd(info.id)
            }}
          />
        ))
      }
    </Popover>
  )
}
