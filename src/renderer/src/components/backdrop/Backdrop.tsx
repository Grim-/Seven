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
import { BACKDROP_DIM, BACKDROP_SCOPES, clearAllBackdrops, setBackdrop, type BackdropScope, type SurfaceBackdropTarget } from './backdropActions'
import { setBoardSurfaceBackdrop, useBoardSurfaces } from '../chat/tabletopStore'
import { cn } from '../../lib/cn'
import { noteFailure } from '../../store/problems'
import { linearFill } from '../../lib/gradients'

export function GradientLayer({ fill }: { fill: string | undefined }) {
  return <div className="absolute inset-0" style={{ background: fill }} />
}

function ImageLayer({ id }: { id: string }) {
  const asset = useAsset(id, 'The backdrop')
  if (!asset) return null
  const url = assetUrl(asset)
  if (asset.kind === 'video') return <video src={url} autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" />
  return <img src={url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
}

export function BackdropLayer({ backdrop, className }: { backdrop: Backdrop; className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} style={{ animation: 'reveal-fade 0.8s ease-out both' }}>
      {backdrop.colors.length > 0 && <GradientLayer fill={linearFill(backdrop.colors)} />}
      {backdrop.image && <ImageLayer id={backdrop.image} />}
      {backdrop.slideshow && <SlideshowPlayer id={backdrop.slideshow} controls={false} className="absolute inset-0" />}
      {backdrop.dim > 0 && <div className="absolute inset-0 bg-scrim" style={{ opacity: backdrop.dim }} />}
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
    if (sessionId) void useBackdrops.getState().load(sessionId).catch(noteFailure('backdrop', 'Could not load the backdrop'))
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

export function SurfaceBackdrop({ dashboardId, surfaceId }: { dashboardId: string; surfaceId: string }) {
  const { state: surfaceState } = useBoardSurfaces(dashboardId)
  const rawBackdrop = surfaceState.slots.find((s) => s.id === surfaceId)?.backdrop ?? null
  const assets = useData((s) => s.assets)
  const missingAssets = useData((s) => s.missingAssets)
  const pages = useData((s) => s.pages)
  const slideshows = useSlideshows()

  const imageMissing = Boolean(
    rawBackdrop?.image &&
      (missingAssets[rawBackdrop.image] || (assets.length > 0 && !assets.some((a) => a.id === rawBackdrop.image))),
  )
  const slideshowMissing = Boolean(
    rawBackdrop?.slideshow &&
      pages.length > 0 &&
      !slideshows.some((s) => s.id === rawBackdrop.slideshow),
  )

  useEffect(() => {
    if (!rawBackdrop || (!imageMissing && !slideshowMissing)) return
    const nextImage = imageMissing ? null : rawBackdrop.image
    const nextSlideshow = slideshowMissing ? null : rawBackdrop.slideshow
    const next: Backdrop | null =
      rawBackdrop.colors.length || nextImage || nextSlideshow
        ? { ...rawBackdrop, image: nextImage, slideshow: nextSlideshow }
        : null
    setBoardSurfaceBackdrop(dashboardId, surfaceId, next)
  }, [dashboardId, surfaceId, rawBackdrop, imageMissing, slideshowMissing])

  if (!rawBackdrop) return null
  const active: Backdrop | null =
    rawBackdrop.colors.length || (!imageMissing && rawBackdrop.image) || (!slideshowMissing && rawBackdrop.slideshow)
      ? {
          ...rawBackdrop,
          image: imageMissing ? null : rawBackdrop.image,
          slideshow: slideshowMissing ? null : rawBackdrop.slideshow,
        }
      : null
  if (!active) return null
  return <BackdropLayer key={JSON.stringify(active)} backdrop={active} />
}


const PRESETS = ['#0b0d12', '#1a0f2e', '#0f2a2e', '#2e1a0f', '#2e0f17', '#0f1f3a', '#1f2e0f', '#333333']

export function BackdropPicker({
  sessionId,
  surfaceTarget,
  initialScope,
  onClose,
}: {
  sessionId: string | null
  surfaceTarget?: SurfaceBackdropTarget | null
  initialScope?: BackdropScope
  onClose: () => void
}) {
  const assets = useData((s) => s.assets)
  const images = assets.filter((a) => a.kind === 'image' || a.kind === 'video').map((a) => a.id)
  const { state: surfaceState } = useBoardSurfaces(surfaceTarget?.dashboardId ?? null)
  const surfaceBackdrop = surfaceTarget ? (surfaceState.slots.find((s) => s.id === surfaceTarget.surfaceId)?.backdrop ?? null) : null
  const chatState = useBackdrops((s) => (sessionId ? s.chats[sessionId] : undefined))
  const appBackdrop = useApp((s) => s.settings?.backdrop ?? null)
  const allChatsBackdrop = useApp((s) => s.settings?.chatBackdrop ?? null)
  const timedBackdrop = chatState?.timed && chatState.timed.until > Date.now() ? chatState.timed.backdrop : null
  const chatBackdrop = chatState?.chat ?? null

  useEffect(() => {
    if (sessionId && !chatState) {
      void useBackdrops.getState().load(sessionId).catch(noteFailure('backdrop', 'Could not load the backdrop'))
    }
  }, [sessionId, chatState])

  const backdropForScope = (targetScope: BackdropScope): Backdrop | null => {
    if (targetScope === 'surface') return surfaceBackdrop
    if (targetScope === 'chat') return chatBackdrop
    if (targetScope === 'timed') return timedBackdrop
    if (targetScope === 'chats') return allChatsBackdrop
    return appBackdrop
  }

  const availableScopes: BackdropScope[] = [
    ...(surfaceTarget ? (['surface'] as const) : []),
    ...(sessionId ? (['chat', 'timed'] as const) : []),
    'chats',
    'app',
  ]
  const activeScopeMatch = availableScopes.find((s) => Boolean(backdropForScope(s)))
  const defaultScope: BackdropScope =
    initialScope && availableScopes.includes(initialScope)
      ? initialScope
      : surfaceTarget
        ? 'surface'
        : activeScopeMatch ?? (sessionId ? 'chat' : 'app')

  const initialValue = backdropForScope(defaultScope)
  const [scope, setScope] = useState<BackdropScope>(defaultScope)
  const [colors, setColors] = useState<string[]>(() => initialValue?.colors ?? [])
  const [image, setImage] = useState<string | null>(() => initialValue?.image ?? null)
  const [slideshow, setSlideshow] = useState<string | null>(() => initialValue?.slideshow ?? null)
  const slideshows = useSlideshows()
  const [dim, setDim] = useState<number>(() => initialValue?.dim ?? BACKDROP_DIM)
  const [minutes, setMinutes] = useState(10)

  const syncScope = (nextScope: BackdropScope) => {
    const cur = backdropForScope(nextScope)
    setScope(nextScope)
    setColors(cur?.colors ?? [])
    setImage(cur?.image ?? null)
    setSlideshow(cur?.slideshow ?? null)
    setDim(cur?.dim ?? BACKDROP_DIM)
  }

  const currentSaved = backdropForScope(scope)
  const hasAnyActive = availableScopes.some((s) => Boolean(backdropForScope(s)))
  const backdrop: Backdrop | null = colors.length || image || slideshow ? { colors, image, slideshow, dim } : null
  const toggleColor = (c: string) => setColors(colors.includes(c) ? colors.filter((x) => x !== c) : [...colors, c].slice(-4))

  const apply = async (value: Backdrop | null) => {
    try {
      await setBackdrop(scope, value, sessionId, minutes, surfaceTarget)
      onClose()
    } catch (err) {
      toast.error('Could not change the background', errorText(err))
    }
  }

  const resetAll = async () => {
    try {
      await clearAllBackdrops(sessionId, surfaceTarget)
      onClose()
    } catch (err) {
      toast.error('Could not reset backgrounds', errorText(err))
    }
  }

  return (
    <Modal
      open
      title="Background"
      onClose={onClose}
      footer={
        <>
          {hasAnyActive && (
            <Button variant="ghost" onClick={() => void resetAll()} title="Clear all chat, app, timed, and surface backgrounds back to default">
              Reset all
            </Button>
          )}
          <Button variant="ghost" onClick={() => void apply(null)}>
            Clear
          </Button>
          <Button variant="primary" disabled={!backdrop && !currentSaved} onClick={() => void apply(backdrop)}>
            Apply
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ShellTabs<BackdropScope>
          value={scope}
          onChange={syncScope}
          options={availableScopes.map((value) => {
            const baseLabel = value === 'surface' && surfaceTarget?.label ? `Surface: ${surfaceTarget.label}` : BACKDROP_SCOPES[value]
            return {
              value,
              label: backdropForScope(value) ? `${baseLabel} •` : baseLabel,
            }
          })}
        />
        {scope === 'surface' && <div className="text-[12px] text-dim">Saved to this SurfaceTop in tabletop view. If a picture or slideshow is later deleted from Data, this surface clears it and returns to normal.</div>}
        {scope === 'chats' && <div className="text-[12px] text-dim">Fills the chat window in every chat, over the app background. An agent's own background, or one set for a single chat, shows instead.</div>}
        {scope === 'timed' && (
          <label className="flex items-center gap-3 text-[12.5px] text-dim">
            Minutes
            <Slider value={minutes} onChange={setMinutes} min={1} max={120} />
            <span className="w-8 font-ui text-ink">{minutes}</span>
          </label>
        )}
        <div>
          <div className="mb-1.5 font-label text-[10.5px] caps-14 text-accent-soft">Colours (pick up to 4 for a gradient)</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map((c) => (
              <button key={c} onClick={() => toggleColor(c)} className={cn('h-7 w-7 border', colors.includes(c) ? 'border-accent' : 'border-line/50')} style={{ background: c }} />
            ))}
            <input type="color" className="h-7 w-9 cursor-pointer border border-line/50 bg-transparent" onChange={(e) => toggleColor(e.target.value)} />
            {colors.length > 0 && <div className="ml-2 h-7 w-24 border border-line/50" style={{ background: linearFill(colors) }} />}
          </div>
        </div>
        <div>
          <div className="mb-1.5 font-label text-[10.5px] caps-14 text-accent-soft">Picture from Data</div>
          {images.length ? (
            <PictureGrid ids={images} min="4.5rem" isOn={(id) => id === image} onPick={(id) => setImage(image === id ? null : id)} className="max-h-48 overflow-y-auto pr-1" />
          ) : (
            <div className="text-[12px] text-faint">No pictures in Data yet.</div>
          )}
        </div>
        <div>
          <div className="mb-1.5 font-label text-[10.5px] caps-14 text-accent-soft">Slideshow</div>
          {slideshows.length ? (
            <Select value={slideshow ?? ''} options={[{ value: '', label: 'None' }, ...slideshows.map((s) => ({ value: s.id, label: showName(s.title) }))]} onChange={(v) => setSlideshow(v || null)} className="w-64" />
          ) : (
            <div className="text-[12px] text-faint">No slideshows yet. Make one in Data.</div>
          )}
        </div>
        <label className="flex items-center gap-3 text-[12.5px] text-dim">
          Darken
          <Slider value={Math.round(dim * 100)} onChange={(v) => setDim(v / 100)} min={0} max={90} />
          <span className="w-8 font-ui text-ink">{Math.round(dim * 100)}%</span>
        </label>
      </div>
    </Modal>
  )
}

export function BackdropButton({
  sessionId,
  surfaceTarget,
  initialScope,
  trigger,
}: {
  sessionId: string | null
  surfaceTarget?: SurfaceBackdropTarget | null
  initialScope?: BackdropScope
  trigger?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button title="Background" onClick={() => setOpen(true)} className={trigger ? 'flex' : 'flex h-7 w-7 items-center justify-center border border-line/60 text-dim hover:text-ink'}>
        {trigger ?? <ImageIcon className="h-4 w-4" />}
      </button>
      {open && <BackdropPicker sessionId={sessionId} surfaceTarget={surfaceTarget} initialScope={initialScope} onClose={() => setOpen(false)} />}
    </>
  )
}
