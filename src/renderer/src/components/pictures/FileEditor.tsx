import { useEffect, useRef, useState } from 'react'
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
import { Button, Eyebrow, Input, SaveState, useDraft } from '../ui'
import { MarkdownEditor } from '../data/MarkdownEditor'
import { PICTURE_SPACE, areaShape } from './AreaLayer'
import { ShapeEditor } from '../shapes/ShapeEditor'
import { AssetPreview } from '../data/AssetView'
import { assetUrl } from '../../store/data'
import { engine } from '../../lib/ipc'
import { cn } from '../../lib/cn'
import { formatBytes } from '../../lib/format'
import { useViewPlace } from '../../lib/viewPlace'

export const VIEWABLE_MEDIA_KINDS: AssetMeta['kind'][] = ['image', 'video']

const NEW_AREA = 'New area'

function AgentReads({ asset }: { asset: AssetMeta }) {
  const [text, setText] = useState('')
  const key = JSON.stringify([asset.description, asset.areas])
  useEffect(() => {
    let live = true
    engine('library.read', { entry: `@file:${asset.id}` })
      .then((t) => live && setText(t))
      .catch(() => live && setText(''))
    return () => {
      live = false
    }
  }, [asset.id, key])
  if (!text) return <span className="font-mono text-[11px] text-faint">No agent notes yet.</span>
  return (
    <pre className="whitespace-pre-wrap border border-dashed border-cyan/35 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-cyan/85">
      {text}
    </pre>
  )
}

export interface FileEditorProps {
  asset: AssetMeta
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
  positionText?: string
  showInspector?: boolean
  onToggleInspector?: () => void
}

export function FileEditor({
  asset,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  positionText,
  showInspector: externalShowInspector,
  onToggleInspector
}: FileEditorProps) {
  const picture = asset.kind === 'image'
  const source = { description: asset.description ?? '', areas: asset.areas ?? [] }
  const { draft, change, status, error } = useDraft(source, (v) =>
    engine('data.assets.describe', { id: asset.id, description: v.description, areas: v.areas })
  )

  const [localInspector, setLocalInspector] = useViewPlace<boolean>('fileViewer.inspectorOpen', false)
  const showInspector = externalShowInspector ?? localInspector
  const setShowInspector = (open: boolean) => {
    if (onToggleInspector && externalShowInspector !== undefined) {
      if (open !== externalShowInspector) onToggleInspector()
    } else {
      setLocalInspector(open)
    }
  }

  const [inspectorWidth, setInspectorWidth] = useViewPlace<number>('fileViewer.inspectorWidth', 360)
  const [isResizing, setIsResizing] = useState(false)
  const [marking, setMarking] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [actualSize, setActualSize] = useState(false)
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

  return (
    <div ref={containerRef} className="relative flex h-full min-h-0 w-full flex-1 overflow-hidden select-none">
      {/* Main Viewing Canvas */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden bg-black/60">
        {!picture ? (
          <div className="flex h-full w-full items-center justify-center p-4">
            <AssetPreview asset={asset} large />
          </div>
        ) : (
          <div
            className={cn(
              'relative flex h-full w-full items-center justify-center overflow-auto p-2',
              actualSize && 'items-start justify-start p-4'
            )}
          >
            <ShapeEditor
              size={PICTURE_SPACE}
              shapes={shapes}
              onChange={setShapes}
              selected={selected}
              onSelect={setSelected}
              drawing={marking ? 'box' : null}
              onDrawn={() => setMarking(false)}
              newLabel={NEW_AREA}
              className="max-w-full"
            >
              <img
                src={assetUrl(asset)}
                alt={asset.name}
                draggable={false}
                onLoad={(e) =>
                  setDimensions({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
                }
                className={cn(
                  'block select-none shadow-2xl transition-all',
                  actualSize
                    ? 'h-auto w-auto max-h-none max-w-none'
                    : 'h-auto w-auto max-h-[calc(100vh-165px)] max-w-full object-contain'
                )}
              />
            </ShapeEditor>
          </div>
        )}

        {/* Left Navigation Paddle */}
        {hasPrev && onPrev && (
          <button
            type="button"
            title="Previous file (Left Arrow)"
            onClick={onPrev}
            className="group absolute left-3 top-1/2 z-20 flex h-16 w-10 -translate-y-1/2 cursor-pointer items-center justify-center border border-line/60 bg-black/75 text-dim opacity-30 shadow-lg transition-all hover:border-accent hover:bg-black/90 hover:text-white hover:opacity-100"
          >
            <ChevronLeft className="h-6 w-6 transition-transform group-hover:-translate-x-0.5" />
          </button>
        )}

        {/* Right Navigation Paddle */}
        {hasNext && onNext && (
          <button
            type="button"
            title="Next file (Right Arrow)"
            onClick={onNext}
            className="group absolute right-3 top-1/2 z-20 flex h-16 w-10 -translate-y-1/2 cursor-pointer items-center justify-center border border-line/60 bg-black/75 text-dim opacity-30 shadow-lg transition-all hover:border-accent hover:bg-black/90 hover:text-white hover:opacity-100"
          >
            <ChevronRight className="h-6 w-6 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}

        {/* Floating Telemetry Badge (Bottom-Left) */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-2">
          <div className="flex items-center gap-2 border border-line/50 bg-black/85 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider backdrop-blur-sm">
            <span className="font-semibold text-white/90">{asset.name}</span>
            {dimensions && <span className="font-semibold text-cyan">{dimensions.w} × {dimensions.h}</span>}
            <span className="text-faint">{formatBytes(asset.size)}</span>
            {positionText && (
              <span className="border-l border-line/50 pl-2 font-semibold text-accent">{positionText}</span>
            )}
          </div>
        </div>

        {/* Floating Quick Action Bar (Bottom-Right) */}
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5">
          {picture && (
            <button
              type="button"
              title={actualSize ? 'Fit to window' : 'Original 1:1 scale'}
              onClick={() => setActualSize(!actualSize)}
              className={cn(
                'border px-2 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-wider shadow transition-colors',
                actualSize
                  ? 'border-accent bg-accent/20 text-accent'
                  : 'border-line/60 bg-black/80 text-dim hover:border-line hover:text-white'
              )}
            >
              {actualSize ? 'FIT' : '1:1'}
            </button>
          )}
          {picture && (
            <button
              type="button"
              title={marking ? 'Click & drag box on picture' : 'Mark an interactive area'}
              onClick={toggleMarking}
              className={cn(
                'flex items-center gap-1 border px-2 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-wider shadow transition-colors',
                marking
                  ? 'border-accent bg-accent text-black'
                  : 'border-line/60 bg-black/80 text-dim hover:border-line hover:text-white'
              )}
            >
              <SquareDashedMousePointer className="h-3 w-3" />
              <span>{marking ? 'MARKING' : 'MARK'}</span>
            </button>
          )}
          <button
            type="button"
            title={showInspector ? 'Hide editor and metadata tools' : 'Show editor and metadata tools'}
            onClick={() => setShowInspector(!showInspector)}
            className={cn(
              'flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-wider shadow transition-colors',
              showInspector
                ? 'border-accent bg-accent/20 text-accent'
                : 'border-line/60 bg-black/80 text-dim hover:border-accent hover:text-white'
            )}
          >
            <SlidersHorizontal className="h-3 w-3" />
            <span>{showInspector ? 'HIDE TOOLS' : 'TOOLS'}</span>
          </button>
        </div>
      </div>

      {/* Resizable Inspector Drawer */}
      {showInspector && (
        <aside
          style={{ width: `${inspectorWidth}px` }}
          className="relative flex min-h-0 shrink-0 select-none flex-col border-l border-line/60 bg-panel text-left overflow-hidden"
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
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-line/60 bg-black/30 px-3 pl-4">
            <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              EDITOR & METADATA
            </span>
            <div className="flex items-center gap-1">
              <SaveState status={status} error={error} />
              <button
                type="button"
                title={inspectorWidth >= 520 ? 'Compact width' : 'Expand width'}
                onClick={toggleExpand}
                className="p-1 text-dim hover:bg-white/[0.05] hover:text-white"
              >
                {inspectorWidth >= 520 ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                title="Close tools"
                onClick={() => setShowInspector(false)}
                className="p-1 text-dim hover:bg-white/[0.05] hover:text-alert"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Scrollable Contents */}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3.5 pl-4 font-mono select-text">
            {/* Areas Section */}
            {picture && (
              <div className="flex flex-col gap-2 border-b border-line/40 pb-4">
                <div className="flex items-center justify-between">
                  <Eyebrow>Areas & Annotations</Eyebrow>
                  <Button
                    size="sm"
                    variant={marking ? 'primary' : 'badge'}
                    icon={<SquareDashedMousePointer />}
                    onClick={toggleMarking}
                  >
                    {marking ? 'Drawing box...' : 'Mark an area'}
                  </Button>
                </div>
                {!draft.areas.length && (
                  <span className="text-[11.5px] text-faint">
                    Mark an area and drag a box on the picture. Named areas can be clicked when an agent
                    shows it.
                  </span>
                )}
                {draft.areas.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => setSelected(a.id)}
                    className={cn(
                      'flex flex-col gap-1 border bg-black/45 p-2 transition-colors',
                      a.id === selected ? 'border-cyan' : 'border-line/40'
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <Input
                        autoFocus={a.id === selected && !a.name}
                        value={a.name}
                        placeholder="NAME THIS AREA"
                        onChange={(e) => setArea(a.id, { name: e.target.value })}
                        className="h-7 flex-1 font-mono text-[12px] uppercase"
                      />
                      <button
                        type="button"
                        title="Remove this area"
                        onClick={() => remove(a.id)}
                        className="p-1 text-faint hover:text-alert"
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

            {/* Description Section */}
            <div className="flex flex-col gap-1.5 border-b border-line/40 pb-4">
              <Eyebrow>Description</Eyebrow>
              <MarkdownEditor
                compact
                value={draft.description}
                placeholder={
                  picture
                    ? "What's in the picture. Agents can't see pictures, so this is what they know."
                    : 'What this file is, for agents and search.'
                }
                onValue={(description) => change((d) => ({ ...d, description }))}
              />
            </div>

            {/* What the Agent Reads */}
            <div className="flex flex-col gap-1.5 border-b border-line/40 pb-4">
              <Eyebrow className="text-cyan/80">What the agent reads</Eyebrow>
              <AgentReads asset={asset} />
            </div>

            {/* File Telemetry */}
            <div className="flex flex-col gap-2">
              <Eyebrow>File Telemetry</Eyebrow>
              <div className="grid grid-cols-[70px_1fr] gap-x-2 gap-y-1.5 text-[11px]">
                <span className="text-faint">ID</span>
                <span className="truncate font-mono text-white/85 select-all" title={asset.id}>
                  {asset.id}
                </span>
                <span className="text-faint">Kind</span>
                <span className="text-white/85">
                  {asset.kind} ({asset.mime})
                </span>
                {dimensions && (
                  <>
                    <span className="text-faint">Canvas</span>
                    <span className="text-cyan font-semibold">
                      {dimensions.w} × {dimensions.h} px
                    </span>
                  </>
                )}
                <span className="text-faint">Size</span>
                <span className="text-white/85">{formatBytes(asset.size)}</span>
                <span className="text-faint">From</span>
                <span className="break-all text-white/85">{asset.source.original ?? '—'}</span>
                <span className="text-faint">Added</span>
                <span className="text-white/85">{new Date(asset.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
