import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  SquareDashedMousePointer,
  Trash2,
  X
} from 'lucide-react'
import type { AssetMeta, PictureArea } from '@shared/types'
import { shapeBounds, type Shape } from '@shared/shapes'
import { Button, Eyebrow, Input, SaveState, StatusBadge, useDraft } from '../ui'
import { MarkdownEditor } from '../data/MarkdownEditor'
import { PICTURE_SPACE, areaShape } from './AreaLayer'
import { ShapeEditor } from '../shapes/ShapeEditor'
import { AssetPreview } from '../data/AssetView'
import { ZoomableImageViewport } from './ZoomableImageViewport'
import { assetUrl } from '../../store/data'
import { engine } from '../../lib/ipc'
import { cn } from '../../lib/cn'
import { formatBytes } from '../../lib/format'
import { useViewPlace } from '../../lib/viewPlace'
import { noteFailure } from '../../store/problems'

export const VIEWABLE_MEDIA_KINDS: AssetMeta['kind'][] = ['image', 'video']

const NEW_AREA = 'New area'

function AgentReads({ asset }: { asset: AssetMeta }) {
  const [text, setText] = useState('')
  const key = JSON.stringify([asset.description, asset.areas])
  useEffect(() => {
    let live = true
    engine('library.read', { entry: `@file:${asset.id}` })
      .then((t) => live && setText(t))
      .catch(noteFailure('files', 'Could not read the agent notes', () => live && setText('')))
    return () => {
      live = false
    }
  }, [asset.id, key])
  if (!text) return <span className="font-ui text-[11px] text-faint">No agent notes yet.</span>
  return (
    <pre className="whitespace-pre-wrap border border-dashed border-secondary-ink/35 px-2.5 py-2 font-ui text-[11px] leading-relaxed text-secondary-ink/85">
      {text}
    </pre>
  )
}

function ScanRevealStage({
  stage,
  text,
  progress,
  targetDimensions
}: {
  stage?: string
  text?: string
  progress?: number | null
  targetDimensions?: { w: number; h: number } | null
}) {
  const [fallbackPct, setFallbackPct] = useState(6)

  useEffect(() => {
    if (typeof progress === 'number') return
    setFallbackPct(6)
    const started = Date.now()
    const timer = window.setInterval(() => {
      const elapsedSec = (Date.now() - started) / 1000
      // Smooth asymptotic progress toward 92% when server/remote does not report step ratio
      const next = Math.min(92, Math.round(6 + 86 * (1 - Math.exp(-elapsedSec / 14))))
      setFallbackPct(next)
    }, 180)
    return () => window.clearInterval(timer)
  }, [progress])

  const pct = typeof progress === 'number' ? Math.max(2, Math.min(100, Math.round(progress * 100))) : fallbackPct
  const aspectW = Math.max(64, targetDimensions?.w ?? 1024)
  const aspectH = Math.max(64, targetDimensions?.h ?? 1024)

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div
        style={{ aspectRatio: `${aspectW} / ${aspectH}` }}
        className="relative max-h-full max-w-full min-h-[14rem] min-w-[14rem] flex-1 overflow-hidden border border-line/70 tone-well-85 shadow-2xl"
      >
        {/* Subtle technical grid over unscanned canvas */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(to right, color-mix(in srgb, var(--color-line) 55%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--color-line) 55%, transparent) 1px, transparent 1px)',
            backgroundSize: '28px 28px'
          }}
        />

        {/* Progressively scanned region from top -> current scan frontier */}
        <div
          style={{ height: `${pct}%` }}
          className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden transition-[height] duration-300 ease-out"
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 14%, transparent) 0%, color-mix(in srgb, var(--color-accent) 8%, transparent) 78%, color-mix(in srgb, var(--color-accent) 26%, transparent) 100%)'
            }}
          />
          {/* Fine optical scanline lattice inside the scanned zone */}
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'repeating-linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 24%, transparent) 0px, color-mix(in srgb, var(--color-accent) 24%, transparent) 1px, transparent 1px, transparent 4px)'
            }}
          />
        </div>

        {/* Active glowing horizontal scanner frontier */}
        <div
          style={{ top: `${pct}%` }}
          className="pointer-events-none absolute inset-x-0 z-10 -translate-y-1/2 transition-[top] duration-300 ease-out"
        >
          <div
            className="h-12 w-full -translate-y-1/2"
            style={{
              background:
                'linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--color-accent) 22%, transparent) 46%, var(--color-accent) 50%, color-mix(in srgb, var(--color-accent) 16%, transparent) 58%, transparent 100%)'
            }}
          />
          <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-accent shadow-[0_0_16px_var(--color-accent)]" />
        </div>

        {/* Secondary continuous subtle sweep pass so indeterminate phases feel alive */}
        {typeof progress !== 'number' && (
          <div
            className="seven-scan-beam pointer-events-none absolute inset-x-0 h-[1px] opacity-60"
            style={{ background: 'linear-gradient(90deg, transparent, var(--color-accent), transparent)' }}
          />
        )}

        {/* Corner framing reticles */}
        <div className="pointer-events-none absolute left-2 top-2 h-3 w-3 border-l-2 border-t-2 border-accent/70" />
        <div className="pointer-events-none absolute right-2 top-2 h-3 w-3 border-r-2 border-t-2 border-accent/70" />
        <div className="pointer-events-none absolute bottom-2 left-2 h-3 w-3 border-b-2 border-l-2 border-accent/70" />
        <div className="pointer-events-none absolute bottom-2 right-2 h-3 w-3 border-b-2 border-r-2 border-accent/70" />

        {/* Centered minimal scan telemetry */}
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 px-4 text-center">
          <div className="flex items-center gap-2 border border-accent/55 tone-panel-90 px-3 py-1.5 shadow-panel backdrop-blur-[var(--panel-blur)]">
            <StatusBadge tone="busy">{stage || 'scanning'}</StatusBadge>
            <span className="font-data text-[12px] font-bold text-accent">{pct}%</span>
          </div>
          {text && (
            <span className="max-w-md border border-line/45 tone-panel-85 px-2.5 py-1 font-ui text-[11.5px] text-ink backdrop-blur-[var(--panel-blur)]">
              {text}
            </span>
          )}
          <span className="font-data text-[10px] caps-12 text-faint">
            {aspectW} × {aspectH} px
          </span>
        </div>
      </div>
    </div>
  )
}

export interface FileEditorProps {
  asset?: AssetMeta | null
  /** Optional live streaming image data URL (e.g. intermediate steps from sd-server). */
  liveStreamUrl?: string | null
  /** Stable key for the active stream so incoming step frames keep the user's pan/zoom intact. */
  liveStreamKey?: string
  /** Optional status pill shown on top of the live stream (e.g. "Step 8 / 20"). */
  liveStreamBadge?: string | null
  busy?: boolean
  busyStage?: string
  busyText?: string
  /** Optional 0..1 progress ratio for the gradual scan visual effect while generating. */
  busyProgress?: number | null
  /** Target output dimensions so the scan frame matches the aspect ratio of the incoming image. */
  targetDimensions?: { w: number; h: number } | null
  /** Asset ID of the most recently completed generation so it reveals with a crisp top-to-bottom scan curtain. */
  revealKey?: string | null
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
  positionText?: string
  showInspector?: boolean
  onToggleInspector?: () => void
  /** Separate storage key for inspector open/width state when reused in Image Generator. */
  inspectorStorageKey?: string
  /** Optional floating top-right actions (e.g. Edit / Open in Files / Save as…). */
  topActions?: ReactNode
  /** Optional extra metadata section rendered inside the floating Properties drawer. */
  extraInspector?: ReactNode
  /** Empty state rendered when neither an asset nor a live stream is present. */
  emptyState?: ReactNode
  className?: string
}

export function FileEditor({
  asset = null,
  liveStreamUrl = null,
  liveStreamKey = 'live-stream',
  liveStreamBadge = null,
  busy = false,
  busyStage,
  busyText,
  busyProgress = null,
  targetDimensions = null,
  revealKey = null,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  positionText,
  showInspector: externalShowInspector,
  onToggleInspector,
  inspectorStorageKey = 'fileViewer',
  topActions,
  extraInspector,
  emptyState,
  className
}: FileEditorProps) {
  const isStreaming = Boolean(liveStreamUrl)
  const picture = isStreaming || asset?.kind === 'image'
  const shouldReveal = Boolean(revealKey && asset && asset.id === revealKey && !isStreaming && !busy)
  const source = { description: asset?.description ?? '', areas: asset?.areas ?? [] }
  const { draft, change, status, error } = useDraft(source, async (v) => {
    if (!asset) return
    await engine('data.assets.describe', { id: asset.id, description: v.description, areas: v.areas })
  })

  const [localInspector, setLocalInspector] = useViewPlace<boolean>(`${inspectorStorageKey}.inspectorOpen`, false)
  const showInspector = externalShowInspector ?? localInspector
  const setShowInspector = (open: boolean) => {
    if (onToggleInspector && externalShowInspector !== undefined) {
      if (open !== externalShowInspector) onToggleInspector()
    } else {
      setLocalInspector(open)
    }
  }

  const [inspectorWidth, setInspectorWidth] = useViewPlace<number>(`${inspectorStorageKey}.inspectorWidth`, 360)
  const [isResizing, setIsResizing] = useState(false)
  const [marking, setMarking] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const setArea = (id: string, patch: Partial<PictureArea>) =>
    change((d) => ({ ...d, areas: d.areas.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))
  const remove = (id: string) =>
    change((d) => ({ ...d, areas: d.areas.filter((a) => a.id !== id) }))
  const shapes = draft.areas.map((a) => areaShape(a, a.name || NEW_AREA))
  const setShapes = (next: Shape[]) =>
    change((d) => ({
      ...d,
      areas: next.map((s) => ({
        ...(d.areas.find((a) => a.id === s.id) ?? { id: s.id, name: '', note: '' }),
        ...shapeBounds(s.form)
      }))
    }))

  const toggleMarking = () => {
    if (!asset || isStreaming) return
    if (!marking && !showInspector) {
      setShowInspector(true)
    }
    setMarking(!marking)
  }

  const toggleExpand = () => {
    if (inspectorWidth >= 520) {
      setInspectorWidth(340)
    } else {
      setInspectorWidth(560)
    }
  }

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = inspectorWidth
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX
      const nextWidth = Math.max(300, Math.min(840, startWidth + delta))
      setInspectorWidth(nextWidth)
    }
    const onMouseUp = () => {
      setIsResizing(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const hasPropertiesContent = Boolean(asset || extraInspector)
  const hudRightOffset = showInspector && hasPropertiesContent ? inspectorWidth + 12 : 12

  const toolButtons = (
    <>
      {asset && asset.kind === 'image' && !isStreaming && (
        <button
          type="button"
          title={marking ? 'Click & drag box on picture' : 'Mark an interactive area'}
          onClick={toggleMarking}
          className={cn(
            'flex h-7 items-center gap-1 border px-2 font-label text-[10px] font-bold caps-5 shadow-panel transition-colors cursor-pointer',
            marking
              ? 'border-accent bg-accent text-on-accent'
              : 'border-line/60 tone-well-85 text-dim hover:border-line hover:text-ink'
          )}
        >
          <SquareDashedMousePointer className="h-3 w-3" />
          <span>{marking ? 'MARKING' : 'MARK'}</span>
        </button>
      )}
      {hasPropertiesContent && (
        <button
          type="button"
          title={showInspector ? 'Hide properties panel' : 'Show properties & metadata panel'}
          onClick={() => setShowInspector(!showInspector)}
          className={cn(
            'flex h-7 items-center gap-1.5 border px-2.5 font-label text-[10px] font-bold caps-5 shadow-panel transition-colors cursor-pointer',
            showInspector
              ? 'border-accent bg-accent/20 text-accent'
              : 'border-line/60 tone-well-85 text-dim hover:border-accent hover:text-ink'
          )}
        >
          <SlidersHorizontal className="h-3 w-3" />
          <span>{showInspector ? 'HIDE PROPERTIES' : 'PROPERTIES'}</span>
        </button>
      )}
    </>
  )

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative h-full min-h-0 w-full flex-1 overflow-hidden select-none tone-panel-60',
        className
      )}
    >
      {/* FULL-SPACE VIEWING CANVAS — IMAGE FRONT AND CENTER, NEVER PUSHED BY PROPERTIES */}
      {isStreaming && liveStreamUrl ? (
        <ZoomableImageViewport
          imageKey={liveStreamKey}
          src={liveStreamUrl}
          alt="Live generation preview"
          onDimensions={setDimensions}
          hudRightOffsetPx={hudRightOffset}
          hudExtra={toolButtons}
        />
      ) : !asset ? (
        busy ? (
          <ScanRevealStage
            stage={busyStage}
            text={busyText}
            progress={busyProgress}
            targetDimensions={targetDimensions}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-[13px] text-faint">
            {emptyState ?? <span>No image selected.</span>}
          </div>
        )
      ) : !picture ? (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <AssetPreview asset={asset} large />
          <div
            style={{ right: hudRightOffset }}
            className="absolute bottom-3 z-20 flex items-center gap-1.5 transition-[right] duration-150"
          >
            {toolButtons}
          </div>
        </div>
      ) : (
        <div key={shouldReveal ? `reveal-${asset.id}` : 'stable'} className={cn('absolute inset-0', shouldReveal && 'seven-scan-curtain')}>
          <ZoomableImageViewport
            imageKey={asset.id}
            src={assetUrl(asset)}
            alt={asset.name}
            suspendPan={marking}
            onDimensions={setDimensions}
            hudRightOffsetPx={hudRightOffset}
            hudExtra={toolButtons}
            wrapImage={(img) => (
              <ShapeEditor
                size={PICTURE_SPACE}
                shapes={shapes}
                onChange={setShapes}
                selected={selected}
                onSelect={setSelected}
                drawing={marking ? 'box' : null}
                onDrawn={() => setMarking(false)}
                newLabel={NEW_AREA}
              >
                {img}
              </ShapeEditor>
            )}
          />
          {shouldReveal && (
            <div className="seven-scan-curtain-line pointer-events-none absolute inset-x-0 z-20 h-[2px] bg-accent shadow-[0_0_16px_var(--color-accent)]" />
          )}
        </div>
      )}

      {/* LIVE STREAMING BADGE (TOP-LEFT) OR BUSY OVERLAY WHEN WAITING FOR FIRST FRAME */}
      {isStreaming ? (
        <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 border border-accent/70 tone-panel-90 px-2.5 py-1 font-data text-[10.5px] text-accent shadow-panel backdrop-blur-[var(--panel-blur)]">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          <span className="font-bold">LIVE STREAM</span>
          {liveStreamBadge && <span className="border-l border-line/50 pl-2 text-ink">{liveStreamBadge}</span>}
        </div>
      ) : busy && asset ? (
        <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 border border-accent/60 tone-panel-90 px-2.5 py-1 text-[11px] shadow-panel backdrop-blur-[var(--panel-blur)]">
          <StatusBadge tone="busy">{busyStage || 'generating'}</StatusBadge>
          {busyText && <span className="font-ui text-ink">{busyText}</span>}
        </div>
      ) : null}

      {/* FLOATING TOP-RIGHT QUICK ACTIONS */}
      {topActions && (
        <div
          style={{ right: hudRightOffset }}
          className="absolute top-3 z-20 flex items-center gap-1 border border-line/60 tone-panel-90 p-1 shadow-panel backdrop-blur-[var(--panel-blur)] transition-[right] duration-150"
        >
          {topActions}
        </div>
      )}

      {/* Left Navigation Paddle */}
      {hasPrev && onPrev && (
        <button
          type="button"
          title="Previous image"
          onClick={onPrev}
          className="group absolute left-3 top-1/2 z-20 flex h-16 w-10 -translate-y-1/2 cursor-pointer items-center justify-center border border-line/60 tone-well-75 text-dim opacity-35 shadow-lg transition-all hover:border-accent hover:tone-well-90 hover:text-ink hover:opacity-100"
        >
          <ChevronLeft className="h-6 w-6 transition-transform group-hover:-translate-x-0.5" />
        </button>
      )}

      {/* Right Navigation Paddle */}
      {hasNext && onNext && (
        <button
          type="button"
          title="Next image"
          onClick={onNext}
          style={{ right: hudRightOffset }}
          className="group absolute top-1/2 z-20 flex h-16 w-10 -translate-y-1/2 cursor-pointer items-center justify-center border border-line/60 tone-well-75 text-dim opacity-35 shadow-lg transition-all hover:border-accent hover:tone-well-90 hover:text-ink hover:opacity-100"
        >
          <ChevronRight className="h-6 w-6 transition-transform group-hover:translate-x-0.5" />
        </button>
      )}

      {/* Floating Telemetry Badge (Bottom-Left) */}
      {(asset || dimensions) && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-2">
          <div className="flex items-center gap-2 border border-line/50 tone-panel-85 px-2.5 py-1 font-label text-[11px] caps-5 backdrop-blur-[var(--panel-blur)]">
            <span className="max-w-60 truncate font-semibold text-ink/90">
              {isStreaming ? 'Incoming preview' : asset?.name ?? 'Image'}
            </span>
            {dimensions && (
              <span className="font-semibold text-secondary-ink">
                {dimensions.w} × {dimensions.h}
              </span>
            )}
            {asset && !isStreaming && <span className="text-faint">{formatBytes(asset.size)}</span>}
            {positionText && (
              <span className="border-l border-line/50 pl-2 font-semibold text-accent">{positionText}</span>
            )}
          </div>
        </div>
      )}

      {/* FLOATING OVERLAY PROPERTIES DRAWER — OVERLAYS IMAGE WITHOUT PUSHING IT SMALLER */}
      {showInspector && hasPropertiesContent && (
        <aside
          style={{ width: `${inspectorWidth}px` }}
          className="absolute inset-y-0 right-0 z-30 flex min-h-0 max-w-[90%] select-none flex-col border-l border-line/70 tone-panel-95 text-left shadow-[-12px_0_32px_color-mix(in_srgb,var(--color-shade)_75%,transparent)] backdrop-blur-[calc(var(--panel-blur)*1.4)] overflow-hidden"
        >
          {/* Inner Drag Handle */}
          <div
            onMouseDown={startResize}
            onDoubleClick={toggleExpand}
            title="Drag to resize, double-click to toggle width"
            className={cn(
              'absolute left-0 top-0 bottom-0 z-30 w-1.5 cursor-ew-resize transition-colors hover:bg-accent/60',
              isResizing && 'bg-accent'
            )}
          />

          {/* Header */}
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-line/60 tone-well-30 px-3 pl-4">
            <span className="flex items-center gap-1.5 font-label text-[11px] font-bold caps-5 text-accent">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              PROPERTIES &amp; METADATA
            </span>
            <div className="flex items-center gap-1">
              {asset && <SaveState status={status} error={error} />}
              <button
                type="button"
                title={inspectorWidth >= 520 ? 'Compact width' : 'Expand width'}
                onClick={toggleExpand}
                className="p-1 text-dim hover:bg-ink/[0.05] hover:text-ink cursor-pointer"
              >
                {inspectorWidth >= 520 ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                title="Close properties"
                onClick={() => setShowInspector(false)}
                className="p-1 text-dim hover:bg-ink/[0.05] hover:text-alert cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Scrollable Contents */}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3.5 pl-4 font-ui select-text">
            {extraInspector}

            {asset && asset.kind === 'image' && (
              <div className="flex flex-col gap-2 border-b border-line/40 pb-4">
                <div className="flex items-center justify-between">
                  <Eyebrow>Areas &amp; Annotations</Eyebrow>
                  <Button
                    size="sm"
                    variant={marking ? 'primary' : 'badge'}
                    icon={<SquareDashedMousePointer />}
                    onClick={toggleMarking}
                  >
                    {marking ? 'Drawing box…' : 'Mark an area'}
                  </Button>
                </div>
                {!draft.areas.length && (
                  <span className="text-[11.5px] text-faint">
                    Mark an area and drag a box on the picture. Named areas can be clicked when an agent shows it.
                  </span>
                )}
                {draft.areas.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => setSelected(a.id)}
                    className={cn(
                      'flex flex-col gap-1 border tone-panel-45 p-2 transition-colors',
                      a.id === selected ? 'border-secondary-ink' : 'border-line/40'
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <Input
                        autoFocus={a.id === selected && !a.name}
                        value={a.name}
                        placeholder="NAME THIS AREA"
                        onChange={(e) => setArea(a.id, { name: e.target.value })}
                        className="h-7 flex-1 font-label text-[12px] caps"
                      />
                      <button
                        type="button"
                        title="Remove this area"
                        onClick={() => remove(a.id)}
                        className="p-1 text-faint hover:text-alert cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Input
                      value={a.note}
                      placeholder="What is it?"
                      onChange={(e) => setArea(a.id, { note: e.target.value })}
                      className="h-7 text-[12px]"
                    />
                  </div>
                ))}
              </div>
            )}

            {asset && (
              <>
                <div className="flex flex-col gap-1.5 border-b border-line/40 pb-4">
                  <Eyebrow>Description</Eyebrow>
                  <MarkdownEditor
                    compact
                    value={draft.description}
                    placeholder={
                      asset.kind === 'image'
                        ? "What's in the picture. Agents can't see pictures, so this is what they know."
                        : 'What this file is, for agents and search.'
                    }
                    onValue={(description) => change((d) => ({ ...d, description }))}
                  />
                </div>

                <div className="flex flex-col gap-1.5 border-b border-line/40 pb-4">
                  <Eyebrow className="text-secondary-ink/80">What the agent reads</Eyebrow>
                  <AgentReads asset={asset} />
                </div>

                <div className="flex flex-col gap-2">
                  <Eyebrow>File Telemetry</Eyebrow>
                  <div className="grid grid-cols-[70px_1fr] gap-x-2 gap-y-1.5 text-[11px]">
                    <span className="text-faint">ID</span>
                    <span className="truncate font-ui text-ink/85 select-all" title={asset.id}>
                      {asset.id}
                    </span>
                    <span className="text-faint">Kind</span>
                    <span className="text-ink/85">
                      {asset.kind} ({asset.mime})
                    </span>
                    {dimensions && (
                      <>
                        <span className="text-faint">Canvas</span>
                        <span className="text-secondary-ink font-semibold">
                          {dimensions.w} × {dimensions.h} px
                        </span>
                      </>
                    )}
                    <span className="text-faint">Size</span>
                    <span className="text-ink/85">{formatBytes(asset.size)}</span>
                    <span className="text-faint">From</span>
                    <span className="break-all text-ink/85">{asset.source.original ?? '—'}</span>
                    <span className="text-faint">Added</span>
                    <span className="text-ink/85">{new Date(asset.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>
      )}
    </div>
  )
}
