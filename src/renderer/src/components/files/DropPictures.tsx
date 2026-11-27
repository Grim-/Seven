import { useState } from 'react'
import { Import } from 'lucide-react'
import { Button, Modal } from '../ui'
import { SaveLocationFields, type SaveLocation } from './SaveLocationFields'
import { importInto, nextPlacing, usePlacing } from '../../lib/dropFiles'
import { useObjectUrl } from '../../lib/useObjectUrl'
import type { DroppedFile } from '../../lib/useFileDrop'
import { useApp } from '../../store/app'

const SHOWN = 8

function Thumb({ file }: { file: File }) {
  const url = useObjectUrl(file)
  return <div className="h-12 w-16 shrink-0 overflow-hidden border border-line/60">{url && <img src={url} alt={file.name} draggable={false} className="h-full w-full object-cover" />}</div>
}

function PlacePictures({ dropped }: { dropped: DroppedFile[] }) {
  const prefs = useApp((s) => s.settings?.droppedPictures)
  const updateSettings = useApp((s) => s.updateSettings)
  const [value, setValue] = useState<SaveLocation>({ folder: prefs?.folder ?? '', remember: false, tags: [] })
  const go = () => {
    if (value.remember) void updateSettings({ droppedPictures: { ask: false, folder: value.folder.trim() } })
    void importInto(dropped, value.folder)
    nextPlacing()
  }
  return (
    <Modal
      open
      title={dropped.length === 1 ? 'Where should this picture go?' : `Where should these ${dropped.length} pictures go?`}
      onClose={nextPlacing}
      footer={
        <>
          <span className="flex-1" />
          <Button variant="ghost" onClick={nextPlacing}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Import />} onClick={go}>
            Import
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {dropped.slice(0, SHOWN).map((d) => (
            <Thumb key={d.path} file={d.file} />
          ))}
          {dropped.length > SHOWN && <span className="font-ui text-[11px] text-faint">+{dropped.length - SHOWN} more</span>}
        </div>
        <SaveLocationFields
          value={value}
          onChange={setValue}
          withTags={false}
          rememberLabel="Put dropped pictures here from now on without asking"
          hint="Hold Shift while dropping to see this again. Change it in Settings."
        />
      </div>
    </Modal>
  )
}

export function DropPicturesHost() {
  const next = usePlacing((s) => s.queue[0])
  return next ? <PlacePictures key={next.id} dropped={next.dropped} /> : null
}
