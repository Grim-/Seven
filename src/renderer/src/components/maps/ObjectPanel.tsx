import { Link2, X } from 'lucide-react'
import type { ObjectLayerData } from '@shared/maps'
import { ActionBar, Eyebrow, Input, Popover, type MenuItem } from '../ui'
import { EntryPicker } from '../library/EntryPicker'
import { PlayList } from '../play/PlayList'
import type { PlayHolder } from '../play/playHolder'
import { PictureFields } from './PictureFields'
import { entryOf } from './objectActions'

interface Props {
  object: ObjectLayerData
  play: PlayHolder
  actions: MenuItem[]
  onChange: (next: ObjectLayerData) => void
}

export function ObjectPanel({ object, play, actions, onChange }: Props) {
  const entry = entryOf(object)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <Eyebrow>Object</Eyebrow>
        <Input value={object.name} onChange={(e) => onChange({ ...object, name: e.target.value })} />
        <PictureFields layer={object} onChange={onChange} />
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">Opens</span>
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/90">{entry ? `${entry.kind}: ${entry.id}` : 'nothing'}</span>
          <Popover trigger={<Link2 className="h-3.5 w-3.5 text-accent" />} title="Open an entry when used">
            {(close) => <EntryPicker kind={null} title="Opens" inline onClose={close} onPick={(hit) => (onChange({ ...object, entry: `${hit.kind}:${hit.id}` }), close())} />}
          </Popover>
          {entry && (
            <button type="button" title="Open nothing" onClick={() => onChange({ ...object, entry: null })} className="text-faint hover:text-alert">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <PlayList play={play} />
      </div>
      <ActionBar items={actions} className="shrink-0 border-t border-line/40 p-2.5" />
    </div>
  )
}
