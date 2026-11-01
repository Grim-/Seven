import { useState } from 'react'
import { Copy, FileDown } from 'lucide-react'
import type { CarryMode } from '@shared/carry'
import { Button, Modal, Textarea, Toggle } from '../ui'
import { AssetMedia } from '../pictures/AssetMedia'
import { PictureField } from '../pictures/PictureField'
import { engine, main } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { toast } from '../../store/toasts'
import { useVault } from '../../store/vault'
import { openEntry } from '../../lib/library'
import { closeCarry, nextArrived, useCarry, type Arrival, type CarryTarget } from './carryStore'
import { placePictures } from '../../lib/dropFiles'
import { useObjectUrl } from '../../lib/useObjectUrl'

const PNG = ['image/png']

function SaveIntoPicture({ target }: { target: CarryTarget | null }) {
  const vault = useVault((s) => s.status)
  const [picture, setPicture] = useState<string | null>(null)
  const [lock, setLock] = useState(vault.configured)
  const [data, setData] = useState(target ? null : '')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!picture) return
    const path = await main('dialog.savePath', { name: `${target && data === null ? target.title : 'data'}.png` })
    if (!path) return
    setBusy(true)
    try {
      await engine('carry.save', { entry: data === null && target ? target.entry : null, text: data, picture, lock, path })
      toast.success('Saved the picture', path)
      closeCarry()
    } catch (err) {
      failed('Could not save the picture')(err)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      title={`Save into a picture${target && data === null ? ` · ${target.title}` : ''}`}
      onClose={closeCarry}
      footer={
        <>
          {target && (
            <Button variant="ghost" onClick={() => setData(data === null ? '' : null)}>
              {data === null ? 'Data instead of an entry…' : `Carry ${target.title} instead`}
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="ghost" onClick={closeCarry}>
            Cancel
          </Button>
          <Button variant="primary" icon={<FileDown />} disabled={!picture || busy || (data !== null && !data.trim())} onClick={() => void save()}>
            Save picture…
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <PictureField large clearable={false} value={picture} onChange={setPicture} options={{ mimes: PNG, what: 'a PNG picture' }} />
        {data !== null && <Textarea value={data} onChange={(e) => setData(e.target.value)} rows={6} placeholder="Paste any text or JSON to carry" />}
        <div className="flex flex-col gap-1">
          <Toggle checked={lock} onChange={setLock} disabled={!vault.configured} label="Lock it with your vault key" />
          <span className="text-[11.5px] text-faint">{vault.configured ? 'Only your Seven can open it. Untick to let any Seven import it.' : 'Set up the vault in Settings to lock it.'}</span>
        </div>
      </div>
    </Modal>
  )
}

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
            <Button variant="primary" icon={<Copy />} onClick={() => void main('clipboard.write', { text }).then(() => toast.success('Copied'))}>
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
          <div className="font-semibold text-white">{about ? `${about.label}: ${about.title}` : 'Locked with a vault key'}</div>
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
