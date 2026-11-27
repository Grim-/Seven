import { useState } from 'react'
import { Copy } from 'lucide-react'
import type { CarryMode } from '@shared/carry'
import { Button, Modal, Textarea, Toggle } from '../ui'
import { AssetMedia } from '../pictures/AssetMedia'
import { engine, main } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { toast } from '../../store/toasts'
import { openEntry } from '../../lib/library'
import { nextArrived, useCarry, type Arrival } from './carryStore'
import { SaveIntoPicture } from './save/SaveIntoPicture'
import { placePictures } from '../../lib/dropFiles'
import { useObjectUrl } from '../../lib/useObjectUrl'

function Arrived({ arrival }: { arrival: Arrival }) {
  const { found, dropped, ask } = arrival
  const about = found.about
  const preview = useObjectUrl(dropped?.file ?? null)
  const [keep, setKeep] = useState(true)
  const [text, setText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const keepOnly = () => {
    if (dropped) placePictures([dropped], ask)
    nextArrived()
  }
  const open = async (mode: CarryMode) => {
    if (!about) return
    setBusy(true)
    try {
      const result = await engine('carry.open', { source: found.source, mode })
      if (dropped && keep) placePictures([dropped], ask)
      if (result.text !== null) return setText(result.text)
      if (result.entry) {
        const { kind, id } = result.entry
        toast.success(mode === 'replace' ? `Replaced ${about.title}` : `Imported ${about.title}`, about.label, { label: 'Open', onSelect: () => openEntry(kind, id) })
      }
      nextArrived()
    } catch (err) {
      failed('Could not open what the picture carries')(err)
    } finally {
      setBusy(false)
    }
  }
  const saved = new Date(found.savedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <Modal
      open
      title="This picture carries something"
      onClose={nextArrived}
      footer={
        <>
          <Button variant="ghost" onClick={keepOnly}>
            Keep the picture only
          </Button>
          <span className="flex-1" />
          {!about ? null : text !== null ? (
            <Button variant="primary" icon={<Copy />} onClick={() => void main('clipboard.write', { text }).then(() => toast.success('Copied'), failed('Could not copy'))}>
              Copy
            </Button>
          ) : about.kind ? (
            <>
              <Button variant={found.exists ? 'secondary' : 'primary'} disabled={busy} onClick={() => void open('copy')}>
                Import as a copy
              </Button>
              {found.exists && (
                <Button variant="primary" disabled={busy} onClick={() => void open('replace')}>
                  Replace {about.title}
                </Button>
              )}
            </>
          ) : (
            <Button variant="primary" disabled={busy} onClick={() => void open('copy')}>
              Show the data
            </Button>
          )}
        </>
      }
    >
      <div className="flex gap-3">
        <div className="h-20 w-28 shrink-0 overflow-hidden border border-line/60">
          {dropped ? preview && <img src={preview} alt={dropped.file.name} draggable={false} className="h-full w-full object-cover" /> : 'asset' in found.source && <AssetMedia id={found.source.asset} className="h-full w-full" />}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="font-semibold text-ink">{about ? `${about.label}: ${about.title}` : 'Locked with a vault key'}</div>
          <div className="text-[12px] text-dim">
            {found.locked ? 'locked with a vault key' : 'not locked'} · saved {saved}
          </div>
          {!about && <div className="text-[12px] text-faint">Unlock your vault to see what it carries.</div>}
          {about && about.also.length > 0 && <div className="text-[12px] text-dim">Also carries {about.also.join(', ')}</div>}
          {about && found.exists && <div className="text-[12px] text-faint">{`A ${about.label.toLowerCase()} called ${about.title} already exists.`}</div>}
        </div>
      </div>
      {dropped && about && text === null && (
        <div className="mt-3">
          <Toggle checked={keep} onChange={setKeep} label="Keep the picture in Files too" />
        </div>
      )}
      {text !== null && <Textarea value={text} readOnly rows={8} className="mt-3" />}
    </Modal>
  )
}

export function CarryHost() {
  const saving = useCarry((s) => s.saving)
  const arrival = useCarry((s) => s.arrived[0])
  return (
    <>
      {saving && <SaveIntoPicture target={saving === 'data' ? null : saving} />}
      {arrival && <Arrived key={arrival.id} arrival={arrival} />}
    </>
  )
}
