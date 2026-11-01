import { useState } from 'react'
import { Import } from 'lucide-react'
import { Button, Field, Modal, Toggle } from '../ui'
import { FolderInput } from './FolderInput'
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
  const [folder, setFolder] = useState(prefs?.folder ?? '')
  const [always, setAlways] = useState(false)
  const go = () => {
    if (always) void updateSettings({ droppedPictures: { ask: false, folder: folder.trim() } })
    void importInto(dropped, folder)
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
          {dropped.length > SHOWN && <span className="font-mono text-[11px] text-faint">+{dropped.length - SHOWN} more</span>}
        </div>
        <Field label="Folder" hint="Made if it doesn't exist. Leave it empty for the top level.">
          <FolderInput value={folder} onChange={setFolder} />
        </Field>
        <div className="flex flex-col gap-1">
          <Toggle checked={always} onChange={setAlways} label="Put dropped pictures here from now on without asking" />
          <span className="text-[11.5px] text-faint">Hold Shift while dropping to see this again. Change it in Settings.</span>
        </div>
      </div>
    </Modal>
  )
}

export function DropPicturesHost() {
  const next = usePlacing((s) => s.queue[0])
  return next ? <PlacePictures key={next.id} dropped={next.dropped} /> : null
}
