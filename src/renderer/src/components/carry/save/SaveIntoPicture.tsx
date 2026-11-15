import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FileDown, Frame, ImagePlus, Images, Loader2, Lock, LockOpen } from 'lucide-react'
import type { CarryAbout } from '@shared/carry'
import { Button, Modal, OptionTile, Segmented, Textarea } from '../../ui'
import { engine, main } from '../../../lib/ipc'
import { errorText } from '../../../lib/format'
import { failed } from '../../../lib/notify'
import { canvasPngBase64 } from '../../../lib/canvasPng'
import { useImageBitmap } from '../../../lib/useImageBitmap'
import { toast } from '../../../store/toasts'
import { useVault } from '../../../store/vault'
import { useData } from '../../../store/data'
import { usePicturePick } from '../../pictures/usePicturePick'
import type { PictureOptions } from '../../data/PicturePicker'
import { closeCarry, type CarryTarget } from '../carryStore'
import { FramePreview } from './FramePreview'
import { frameLayout, type FrameInfo } from './drawCarryFrame'

const PNG = 'image/png'
const ANY_PICTURE: PictureOptions = { kinds: ['image'], what: 'a picture' }
const PNG_PICTURE: PictureOptions = { mimes: [PNG], what: 'a PNG picture' }
const MODES = [
  { value: 'entry', label: 'This entry', data: false },
  { value: 'data', label: 'Text or JSON', data: true }
]
const STAGE_GLOW = {
  backgroundImage:
    'radial-gradient(circle at 12% 8%, color-mix(in srgb, var(--color-accent) 11%, transparent), transparent 45%), radial-gradient(circle at 88% 92%, color-mix(in srgb, var(--color-teal) 11%, transparent), transparent 45%)'
}

function useAbout(target: CarryTarget | null): { about: CarryAbout | null; error: string | null } {
  const [state, setState] = useState<{ about: CarryAbout | null; error: string | null }>({ about: null, error: null })
  useEffect(() => {
    if (!target) return
    let live = true
    void engine('carry.describe', { entry: target.entry }).then(
      (about) => live && setState({ about, error: null }),
      (err) => live && setState({ about: null, error: errorText(err) })
    )
    return () => {
      live = false
    }
  }, [target?.entry])
  return state
}

function Label({ children }: { children: ReactNode }) {
  return <div className="font-mono text-[10.5px] font-bold uppercase tracking-[0.2em] text-accent-soft">{children}</div>
}

function EmptyPick({ framed, pick }: { framed: boolean; pick: ReturnType<typeof usePicturePick> }) {
  return (
    <div className="bracket flex w-full max-w-md flex-col items-center gap-4 border border-dashed border-line px-8 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center border border-accent text-accent shadow-[0_0_24px_color-mix(in_srgb,var(--color-accent)_30%,transparent)]">
        <ImagePlus className="h-6 w-6" />
      </span>
      <div>
        <div className="font-mono text-[12px] font-bold uppercase tracking-[0.2em] text-accent">Pick a picture</div>
        <div className="mt-1 text-[12.5px] text-dim">{framed ? 'Any picture works: it gets a Seven card frame and is saved as a PNG.' : 'Without the frame, only PNG pictures can carry data.'}</div>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="primary" icon={<Images />} onClick={pick.fromSeven}>
          From Seven
        </Button>
        <Button size="sm" variant="secondary" icon={<ImagePlus />} onClick={pick.fromDisk}>
          From your computer…
        </Button>
      </div>
    </div>
  )
}

function Carrying({ target, about, error }: { target: CarryTarget; about: CarryAbout | null; error: string | null }) {
  return (
    <div className="border border-line/60 bg-black/40 p-3 shadow-[inset_3px_0_0_var(--color-accent)]">
      <span className="inline-block bg-accent px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-black">{about?.label ?? '…'}</span>
      <div className="mt-1.5 break-words text-[15px] font-semibold text-white">{about?.title ?? target.title}</div>
      {error && <div className="mt-1 text-[12px] text-alert">{error}</div>}
      {about && about.also.length > 0 && (
        <ul className="mt-2 flex flex-col gap-0.5">
          {about.also.map((a) => (
            <li key={a} className="font-mono text-[11px] text-teal">
              + {a}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function SaveIntoPicture({ target }: { target: CarryTarget | null }) {
  const vault = useVault((s) => s.status)
  const [picture, setPicture] = useState<string | null>(null)
  const [framed, setFramed] = useState(true)
  const [lock, setLock] = useState(vault.configured)
  const [mode, setMode] = useState(MODES[target ? 0 : 1])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [at] = useState(() => Date.now())
  const canvas = useRef<HTMLCanvasElement>(null)
  const { about, error } = useAbout(target)
  const bitmap = useImageBitmap(picture)
  const mime = useData((s) => (picture ? s.assets.find((a) => a.id === picture)?.mime : undefined))
  const pick = usePicturePick(picture, setPicture, framed ? ANY_PICTURE : PNG_PICTURE)

  const asData = !target || mode.data
  const pngOk = framed || mime === PNG
  const info: FrameInfo = {
    label: asData ? 'Data' : (about?.label ?? 'Entry'),
    title: asData ? text.trim().split('\n')[0].slice(0, 60) || 'Data' : (about?.title ?? target?.title ?? ''),
    also: asData ? 0 : (about?.also.length ?? 0),
    locked: lock,
    at
  }
  const ready = Boolean(picture && bitmap && pngOk && !busy && (asData ? text.trim() : !error))
  const size = bitmap ? (framed ? frameLayout(bitmap.width, bitmap.height) : bitmap) : null

  const save = async () => {
    if (!picture || !ready) return
    const path = await main('dialog.savePath', { name: `${asData ? 'data' : (target?.title ?? 'data')}.png` })
    if (!path) return
    setBusy(true)
    try {
      const image = framed && canvas.current ? await canvasPngBase64(canvas.current) : null
      await engine('carry.save', { entry: asData ? null : (target?.entry ?? null), text: asData ? text : null, picture, lock, path, framed: image })
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
      width={1080}
      title="Save into a picture"
      onClose={closeCarry}
      bodyClassName="flex min-h-0 flex-1 p-0"
      footer={
        <>
          <span className="mr-auto self-center font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
            {framed ? 'Seven card · PNG' : 'Picture as it is'} · {lock ? 'locked to your vault' : 'any Seven can open it'}
          </span>
          <Button variant="ghost" onClick={closeCarry}>
            Cancel
          </Button>
          <Button variant="primary" icon={busy ? <Loader2 className="animate-spin" /> : <FileDown />} disabled={!ready} onClick={() => void save()}>
            Save picture…
          </Button>
        </>
      }
    >
      <div className="grid min-h-0 w-full flex-1 grid-cols-[minmax(0,1fr)_320px] tablet:grid-cols-1">
        <div className="relative flex min-w-0 flex-col bg-black" style={STAGE_GLOW}>
          <div className="hud-scan pointer-events-none absolute inset-0" />
          <div className="relative flex h-[62vh] min-h-[320px] items-center justify-center p-6">
            {bitmap ? (
              <FramePreview bitmap={bitmap} info={info} framed={framed} canvasRef={canvas} />
            ) : picture ? (
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
            ) : (
              <EmptyPick framed={framed} pick={pick} />
            )}
          </div>
          {picture && (
            <div className="relative flex flex-wrap items-center gap-2 border-t border-line/50 bg-black/60 px-4 py-2">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-dim">{size ? `${size.width} × ${size.height} px` : '…'}</span>
              <span className="ml-auto flex gap-1.5">
                <Button size="sm" variant="ghost" icon={<Images />} onClick={pick.fromSeven}>
                  From Seven
                </Button>
                <Button size="sm" variant="ghost" icon={<ImagePlus />} onClick={pick.fromDisk}>
                  From your computer…
                </Button>
              </span>
            </div>
          )}
        </div>
        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-l border-line/60 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-accent)_7%,transparent),transparent_45%)] p-4 tablet:border-l-0 tablet:border-t">
          <section className="flex flex-col gap-2">
            <Label>Carrying</Label>
            {target && <Segmented value={mode.value} options={MODES} onChange={(v) => setMode(MODES.find((m) => m.value === v) ?? MODES[0])} />}
            {asData || !target ? <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder="Paste any text or JSON to carry" className="font-mono text-[12px]" /> : <Carrying target={target} about={about} error={error} />}
          </section>
          <section className="flex flex-col gap-2">
            <Label>Picture</Label>
            <OptionTile icon={<Frame />} title="Seven card frame" hint="A Seven card border with the kind, title and date. Off keeps the picture exactly as it is." checked={framed} onChange={setFramed} />
            <OptionTile
              icon={lock ? <Lock /> : <LockOpen />}
              title="Lock with your vault key"
              hint={vault.configured ? 'Only your Seven can open it. Off lets any Seven import it.' : 'Set up the vault in Settings to lock it.'}
              checked={lock}
              onChange={setLock}
              disabled={!vault.configured}
              color="var(--color-teal)"
            />
            {picture && !pngOk && <div className="border border-alert/60 bg-alert/10 px-3 py-2 text-[12px] text-white">This picture isn't a PNG, so it can't carry data as it is. Turn the frame on, or pick a PNG.</div>}
          </section>
        </aside>
      </div>
    </Modal>
  )
}
