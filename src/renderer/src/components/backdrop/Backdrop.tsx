import { useEffect, useState, type ReactNode } from 'react'
import { ImageIcon } from 'lucide-react'
import type { Backdrop } from '@shared/types'
import { useAsset, useData, assetUrl } from '../../store/data'
import { useBackdrops } from '../../store/backdrops'
import { useApp } from '../../store/app'
import { toast } from '../../store/toasts'
import { errorText } from '../../lib/format'
import { Button, Modal, Select, Slider, ShellTabs } from '../ui'
import { showName } from '@shared/ids'
import { SlideshowPlayer } from '../slideshow/SlideshowPlayer'
import { useSlideshows } from '../slideshow/useSlideshow'
import { PictureGrid } from '../pictures/PictureGrid'
import { BACKDROP_DIM, BACKDROP_SCOPES, setBackdrop, type BackdropScope } from './backdropActions'
import { cn } from '../../lib/cn'

function fill(colors: string[]): string | undefined {
  if (!colors.length) return undefined
  return colors.length === 1 ? colors[0] : `linear-gradient(135deg, ${colors.join(', ')})`
}

function ImageLayer({ id }: { id: string }) {
  const asset = useAsset(id)
  if (!asset) return null
  const url = assetUrl(asset)
  if (asset.kind === 'video') return <video src={url} autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" />
  return <img src={url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
}

export function BackdropLayer({ backdrop, className }: { backdrop: Backdrop; className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} style={{ animation: 'reveal-fade 0.8s ease-out both' }}>
      {backdrop.colors.length > 0 && <div className="absolute inset-0" style={{ background: fill(backdrop.colors) }} />}
      {backdrop.image && <ImageLayer id={backdrop.image} />}
      {backdrop.slideshow && <SlideshowPlayer id={backdrop.slideshow} controls={false} className="absolute inset-0" />}
      {backdrop.dim > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: backdrop.dim }} />}
    </div>
  )
}

export function AppBackdrop() {
  const backdrop = useApp((s) => s.settings?.backdrop ?? null)
  if (!backdrop) return null
  return <BackdropLayer backdrop={backdrop} className="z-0" />
}

export function ChatsBackdrop() {
  const backdrop = useApp((s) => s.settings?.chatBackdrop ?? null)
  if (!backdrop) return null
  return <BackdropLayer key={JSON.stringify(backdrop)} backdrop={backdrop} />
}

export function ChatBackdrop({ sessionId }: { sessionId: string | null }) {
  const state = useBackdrops((s) => (sessionId ? s.chats[sessionId] : undefined))
  const [, tick] = useState(0)
  useEffect(() => {
    if (sessionId) void useBackdrops.getState().load(sessionId).catch(() => undefined)
  }, [sessionId])
  const until = state?.timed?.until ?? 0
  useEffect(() => {
    if (!until) return
    const timer = setTimeout(() => tick((n) => n + 1), Math.max(0, until - Date.now()) + 50)
    return () => clearTimeout(timer)
  }, [until])
  const active = state?.timed && state.timed.until > Date.now() ? state.timed.backdrop : (state?.chat ?? null)
  if (!active) return null
  return <BackdropLayer key={JSON.stringify(active)} backdrop={active} />
}


const PRESETS = ['#0b0d12', '#1a0f2e', '#0f2a2e', '#2e1a0f', '#2e0f17', '#0f1f3a', '#1f2e0f', '#333333']

function BackdropPicker({ sessionId, onClose }: { sessionId: string | null; onClose: () => void }) {
  const assets = useData((s) => s.assets)
  const images = assets.filter((a) => a.kind === 'image' || a.kind === 'video').map((a) => a.id)
  const [scope, setScope] = useState<BackdropScope>(sessionId ? 'chat' : 'app')
  const [colors, setColors] = useState<string[]>([])
  const [image, setImage] = useState<string | null>(null)
  const [slideshow, setSlideshow] = useState<string | null>(null)
  const slideshows = useSlideshows()
  const [dim, setDim] = useState(BACKDROP_DIM)
  const [minutes, setMinutes] = useState(10)

  const backdrop: Backdrop | null = colors.length || image || slideshow ? { colors, image, slideshow, dim } : null
  const toggleColor = (c: string) => setColors(colors.includes(c) ? colors.filter((x) => x !== c) : [...colors, c].slice(-4))

  const apply = async (value: Backdrop | null) => {
    try {
      await setBackdrop(scope, value, sessionId, minutes)
      onClose()
    } catch (err) {
      toast.error('Could not change the background', errorText(err))
    }
  }

  return (
    <Modal
      open
      title="Background"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={() => void apply(null)}>
            Clear
          </Button>
          <Button variant="primary" disabled={!backdrop} onClick={() => void apply(backdrop)}>
            Apply
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ShellTabs<BackdropScope>
          value={scope}
          onChange={setScope}
          options={((sessionId ? ['chat', 'timed', 'chats', 'app'] : ['chats', 'app']) as BackdropScope[]).map((value) => ({ value, label: BACKDROP_SCOPES[value] }))}
        />
        {scope === 'chats' && <div className="text-[12px] text-dim">Fills the chat window in every chat, over the app background. An agent's own background, or one set for a single chat, shows instead.</div>}
        {scope === 'timed' && (
          <label className="flex items-center gap-3 text-[12.5px] text-dim">
            Minutes
            <Slider value={minutes} onChange={setMinutes} min={1} max={120} />
            <span className="w-8 font-mono text-white">{minutes}</span>
          </label>
        )}
        <div>
          <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent-soft">Colours (pick up to 4 for a gradient)</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map((c) => (
              <button key={c} onClick={() => toggleColor(c)} className={cn('h-7 w-7 border', colors.includes(c) ? 'border-accent' : 'border-line/50')} style={{ background: c }} />
            ))}
            <input type="color" className="h-7 w-9 cursor-pointer border border-line/50 bg-transparent" onChange={(e) => toggleColor(e.target.value)} />
            {colors.length > 0 && <div className="ml-2 h-7 w-24 border border-line/50" style={{ background: fill(colors) }} />}
          </div>
        </div>
        <div>
          <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent-soft">Picture from Data</div>
          {images.length ? (
            <PictureGrid ids={images} min="4.5rem" isOn={(id) => id === image} onPick={(id) => setImage(image === id ? null : id)} className="max-h-48 overflow-y-auto pr-1" />
          ) : (
            <div className="text-[12px] text-faint">No pictures in Data yet.</div>
          )}
        </div>
        <div>
          <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent-soft">Slideshow</div>
          {slideshows.length ? (
            <Select value={slideshow ?? ''} options={[{ value: '', label: 'None' }, ...slideshows.map((s) => ({ value: s.id, label: showName(s.title) }))]} onChange={(v) => setSlideshow(v || null)} className="w-64" />
          ) : (
            <div className="text-[12px] text-faint">No slideshows yet. Make one in Data.</div>
          )}
        </div>
        <label className="flex items-center gap-3 text-[12.5px] text-dim">
          Darken
          <Slider value={Math.round(dim * 100)} onChange={(v) => setDim(v / 100)} min={0} max={90} />
          <span className="w-8 font-mono text-white">{Math.round(dim * 100)}%</span>
        </label>
      </div>
    </Modal>
  )
}

export function BackdropButton({ sessionId, trigger }: { sessionId: string | null; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button title="Background" onClick={() => setOpen(true)} className={trigger ? 'flex' : 'flex h-7 w-7 items-center justify-center border border-line/60 text-dim hover:text-white'}>
        {trigger ?? <ImageIcon className="h-4 w-4" />}
      </button>
      {open && <BackdropPicker sessionId={sessionId} onClose={() => setOpen(false)} />}
    </>
  )
}
