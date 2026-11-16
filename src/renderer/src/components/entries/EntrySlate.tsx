import { useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { AppWindow, ChevronDown, ChevronRight, ExternalLink, Layers, Maximize2, Minimize2, PanelRight, Sparkles, X } from 'lucide-react'
import { showName } from '@shared/ids'
import { on } from '../../lib/ipc'
import { presentOf, setDefaultEntrySlate, type EntrySlateProps } from '../../registries/kinds'
import { useEntryPreview } from './entryPreview'
import { AssetMedia } from '../pictures/AssetMedia'
import { Facts, InsideSlateContext } from './EntryCard'
import { Markdown } from '../chat/Markdown'
import { showInData } from '../../lib/library'
import { showInPanel, slateSurfaceMenuItems } from '../data/showInPanel'
import { openMenu } from '../ui'
import { pinToChatTable } from '../chat/tabletopStore'
import { useEscapeLayer } from '../../lib/escape'
import { isTypingTarget, matchesKeybind, useKeybindLabel } from '../../store/keybinds'
import { cn } from '../../lib/cn'

interface SlateRect {
  left: number
  top: number
  width: number
  height: number
}

interface RegisteredFocusSlate {
  maximized: boolean
  toggle: () => void
}

const slateFocusRegistry = new Map<string, RegisteredFocusSlate>()
let lastPointerPos: { x: number; y: number } | null = null
let focusListenersCount = 0

function onFocusPointerMove(e: PointerEvent): void {
  lastPointerPos = { x: e.clientX, y: e.clientY }
}

function findHoveredSlateId(): string | null {
  if (lastPointerPos) {
    const top = document.elementsFromPoint(lastPointerPos.x, lastPointerPos.y)[0]
    const hit = top instanceof Element ? top.closest<HTMLElement>('[data-slate-focus-id]') : null
    if (hit?.dataset.slateFocusId) return hit.dataset.slateFocusId
  }
  const hovered = document.querySelector<HTMLElement>('[data-slate-focus-id]:hover')
  return hovered?.dataset.slateFocusId ?? null
}

function onFocusKeyDown(e: KeyboardEvent): void {
  if (e.defaultPrevented || e.repeat) return
  if (isTypingTarget(e)) return
  if (!matchesKeybind('tabletop.focusSlate', e)) return
  if (document.querySelector('[role="dialog"], [data-seven-menu]')) return

  for (const entry of slateFocusRegistry.values()) {
    if (entry.maximized) {
      e.preventDefault()
      e.stopPropagation()
      entry.toggle()
      return
    }
  }

  const targetId = findHoveredSlateId()
  const target = targetId ? slateFocusRegistry.get(targetId) : undefined
  if (!target) return
  e.preventDefault()
  e.stopPropagation()
  target.toggle()
}

function retainFocusListeners(): () => void {
  if (focusListenersCount === 0) {
    window.addEventListener('pointermove', onFocusPointerMove, { passive: true })
    window.addEventListener('keydown', onFocusKeyDown, true)
  }
  focusListenersCount++
  return () => {
    focusListenersCount = Math.max(0, focusListenersCount - 1)
    if (focusListenersCount === 0) {
      window.removeEventListener('pointermove', onFocusPointerMove)
      window.removeEventListener('keydown', onFocusKeyDown, true)
    }
  }
}

function focusFlipFromRect(rect: SlateRect | null): { x: number; y: number; scaleX: number; scaleY: number } {
  if (!rect || typeof window === 'undefined') {
    return { x: 0, y: 0, scaleX: 0.92, scaleY: 0.92 }
  }
  const vw = Math.max(320, window.innerWidth - 24)
  const vh = Math.max(240, window.innerHeight - 24)
  return {
    x: rect.left + rect.width / 2 - window.innerWidth / 2,
    y: rect.top + rect.height / 2 - window.innerHeight / 2,
    scaleX: Math.max(0.16, Math.min(1, rect.width / vw)),
    scaleY: Math.max(0.08, Math.min(1, rect.height / vh))
  }
}

const FOCUS_RETICLES = [
  'top-0 left-0 border-t-2 border-l-2',
  'top-0 right-0 border-t-2 border-r-2',
  'bottom-0 left-0 border-b-2 border-l-2',
  'bottom-0 right-0 border-b-2 border-r-2'
] as const

export type SlateResizeEdge = 'l' | 'r' | 'b' | 'bl' | 'br'

const RESIZE_HANDLES: {
  edge: SlateResizeEdge
  title: string
  box: string
  grip: string
}[] = [
  {
    edge: 'l',
    title: 'Drag left edge to resize slate',
    box: 'group/rh absolute top-2 -left-1.5 bottom-3 z-20 flex w-3 cursor-ew-resize touch-none items-center justify-center',
    grip: 'h-8 w-0.5 rounded-full bg-accent/0 transition-colors group-hover/rh:bg-accent/70'
  },
  {
    edge: 'r',
    title: 'Drag right edge to resize slate',
    box: 'group/rh absolute top-2 -right-1.5 bottom-3 z-20 flex w-3 cursor-ew-resize touch-none items-center justify-center',
    grip: 'h-8 w-0.5 rounded-full bg-accent/0 transition-colors group-hover/rh:bg-accent/70'
  },
  {
    edge: 'b',
    title: 'Drag bottom edge to resize slate',
    box: 'group/rh absolute right-3 -bottom-1.5 left-3 z-20 flex h-3 cursor-ns-resize touch-none items-center justify-center',
    grip: 'h-0.5 w-10 rounded-full bg-accent/0 transition-colors group-hover/rh:bg-accent/70'
  },
  {
    edge: 'bl',
    title: 'Drag corner to resize slate',
    box: 'group/rh absolute -bottom-1 -left-1 z-30 flex h-6 w-6 cursor-nesw-resize touch-none items-end justify-start p-1',
    grip: 'h-2 w-2 border-b-2 border-l-2 border-accent/0 transition-colors group-hover/rh:border-accent/80'
  },
  {
    edge: 'br',
    title: 'Drag corner to resize slate',
    box: 'group/rh absolute -right-1 -bottom-1 z-30 flex h-6 w-6 cursor-nwse-resize touch-none items-end justify-end p-1',
    grip: 'h-2.5 w-2.5 border-r-2 border-b-2 border-accent/70 transition-colors group-hover/rh:border-accent'
  }
]

export function SlateContainer({
  title,
  tag,
  subtitle,
  thumb,
  entryKey,
  expanded = true,
  maximized: controlledMaximized,
  width,
  height,
  fillCell = false,
  interacting = false,
  slateRef,
  onToggleExpand,
  onToggleMaximize,
  onHeaderPointerDown,
  onHeaderPointerMove,
  onHeaderPointerUp,
  onHeaderPointerCancel,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
  onResizePointerCancel,
  onPin,
  onShowInPanel,
  onOpenData,
  onOpenIn,
  onRemove,
  actions,
  children,
  className
}: {
  title: ReactNode
  tag: string
  subtitle?: ReactNode
  thumb?: ReactNode
  entryKey?: string
  expanded?: boolean
  maximized?: boolean
  width?: number
  height?: number
  fillCell?: boolean
  interacting?: boolean
  slateRef?: Ref<HTMLDivElement>
  onToggleExpand?: () => void
  onToggleMaximize?: () => void
  onHeaderPointerDown?: (e: React.PointerEvent) => void
  onHeaderPointerMove?: (e: React.PointerEvent) => void
  onHeaderPointerUp?: (e: React.PointerEvent) => void
  onHeaderPointerCancel?: (e: React.PointerEvent) => void
  onResizePointerDown?: (e: React.PointerEvent, edge: SlateResizeEdge) => void
  onResizePointerMove?: (e: React.PointerEvent) => void
  onResizePointerUp?: (e: React.PointerEvent) => void
  onResizePointerCancel?: (e: React.PointerEvent) => void
  onPin?: () => void
  onShowInPanel?: () => void
  onOpenData?: () => void
  onOpenIn?: (e: React.MouseEvent) => void
  onRemove?: () => void
  actions?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const focusId = useId()
  const focusKey = useKeybindLabel('tabletop.focusSlate')
  const [localMaximized, setLocalMaximized] = useState(false)
  const [justUpdated, setJustUpdated] = useState(false)
  const [returnEcho, setReturnEcho] = useState<SlateRect | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const originRectRef = useRef<SlateRect | null>(null)
  const wasMaximizedRef = useRef(false)
  const maximized = controlledMaximized ?? localMaximized

  const captureOriginRect = () => {
    if (!boxRef.current) return
    const r = boxRef.current.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) {
      originRectRef.current = { left: r.left, top: r.top, width: r.width, height: r.height }
    }
  }

  const toggleMaximize = () => {
    if (!maximized) captureOriginRect()
    if (onToggleMaximize) onToggleMaximize()
    else setLocalMaximized((v) => !v)
  }

  const focusEntryRef = useRef<RegisteredFocusSlate>({ maximized: false, toggle: () => {} })
  focusEntryRef.current = { maximized, toggle: toggleMaximize }

  useEffect(() => {
    const release = retainFocusListeners()
    const proxy: RegisteredFocusSlate = {
      get maximized() {
        return focusEntryRef.current.maximized
      },
      toggle: () => focusEntryRef.current.toggle()
    }
    slateFocusRegistry.set(focusId, proxy)
    return () => {
      slateFocusRegistry.delete(focusId)
      release()
    }
  }, [focusId])

  useLayoutEffect(() => {
    const prev = wasMaximizedRef.current
    wasMaximizedRef.current = maximized
    if (prev && !maximized) {
      setReturnEcho(originRectRef.current)
      const timer = setTimeout(() => setReturnEcho(null), 130)
      return () => clearTimeout(timer)
    }
    if (!prev && maximized) {
      setReturnEcho(null)
    }
    return undefined
  }, [maximized])

  const assignBoxRef = (el: HTMLDivElement | null) => {
    boxRef.current = el
    if (typeof slateRef === 'function') slateRef(el)
    else if (slateRef && 'current' in slateRef) {
      ;(slateRef as { current: HTMLDivElement | null }).current = el
    }
  }

  useEffect(() => {
    if (!entryKey) return
    const slash = entryKey.indexOf('/')
    const kind = slash > 0 ? entryKey.slice(0, slash) : ''
    const id = slash > 0 ? entryKey.slice(slash + 1) : entryKey
    let timer: ReturnType<typeof setTimeout> | null = null
    const flash = () => {
      setJustUpdated(true)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setJustUpdated(false), 2600)
    }
    const offs: (() => void)[] = [
      on('page.changed', ({ id: changedId }) => {
        if (
          changedId === id ||
          changedId === `${kind}/${id}` ||
          changedId === `${kind}s/${id}` ||
          changedId.endsWith(`/${id}`)
        ) {
          flash()
        }
      })
    ]
    if (kind === 'file') {
      offs.push(
        on('asset.changed', ({ id: changedId }) => {
          if (changedId === id) flash()
        })
      )
    }
    if (kind === 'sheet') {
      offs.push(on('game.changed', flash))
    }
    return () => {
      if (timer) clearTimeout(timer)
      offs.forEach((off) => off())
    }
  }, [entryKey])

  useEscapeLayer(maximized, () => {
    if (controlledMaximized !== undefined) onToggleMaximize?.()
    else setLocalMaximized(false)
  })

  const showBody = expanded || maximized || fillCell
  const hasFixedHeight = maximized || fillCell || (expanded && typeof height === 'number')

  const sizeStyle =
    maximized || fillCell
      ? undefined
      : expanded
        ? {
            width: typeof width === 'number' ? width : 420,
            ...(typeof height === 'number' ? { height } : {})
          }
        : { width: 288 }

  const slateBody = (
    <motion.div
      ref={assignBoxRef}
      data-slate-focus-id={focusId}
      onPointerEnter={() => {
        if (!maximized) captureOriginRect()
      }}
      layout={!maximized && !onResizePointerDown && !fillCell}
      initial={
        maximized
          ? { opacity: 0.72, ...focusFlipFromRect(originRectRef.current) }
          : returnEcho
            ? { opacity: 0.85, scale: 1.015 }
            : false
      }
      animate={{ opacity: 1, x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1 }}
      transition={
        maximized
          ? { duration: 0.155, ease: [0.16, 1, 0.3, 1] }
          : { duration: 0.14, ease: [0.16, 1, 0.3, 1] }
      }
      style={sizeStyle}
      className={cn(
        'group/slate relative flex flex-col',
        maximized
          ? 'h-full w-full'
          : fillCell
            ? 'h-full w-full'
            : expanded
              ? 'max-w-[96vw]'
              : 'w-[288px]',
        className
      )}
    >
      <div
        className={cn(
          'notch-sm relative flex min-h-0 flex-1 flex-col border border-l-2 border-l-accent bg-[#060b10]/78 backdrop-blur-md',
          !interacting && 'transition-[border-color,box-shadow]',
          justUpdated
            ? 'border-accent shadow-[0_0_28px_color-mix(in_srgb,var(--color-accent)_35%,transparent)]'
            : 'border-line shadow-[0_14px_38px_rgba(0,0,0,0.85)] hover:border-line/90'
        )}
      >
        {/* Header: single smooth compact line; click anywhere on header to expand/collapse (or restore when maximized), drag to move */}
        <div
          onPointerDown={!maximized ? onHeaderPointerDown : undefined}
          onPointerMove={!maximized ? onHeaderPointerMove : undefined}
          onPointerUp={!maximized ? onHeaderPointerUp : undefined}
          onPointerCancel={!maximized ? onHeaderPointerCancel : undefined}
          onClick={
            maximized
              ? toggleMaximize
              : !onHeaderPointerDown
                ? onToggleExpand
                : undefined
          }
          className={cn(
            '@container slate-drag-handle flex h-7 shrink-0 items-center gap-1.5 overflow-hidden px-2 whitespace-nowrap select-none @[160px]:px-2.5',
            showBody && 'border-b border-line/40',
            (onToggleExpand || onHeaderPointerDown || fillCell || maximized) && 'cursor-pointer hover:bg-white/[0.03]'
          )}
        >
        {onToggleExpand && !maximized && !fillCell && (
          <span className="hidden shrink-0 text-dim @[130px]:inline-flex">
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </span>
        )}
        {thumb && !showBody && <div className="h-4 w-4 shrink-0 overflow-hidden border border-line/60">{thumb}</div>}
        <span
          title={typeof subtitle === 'string' ? subtitle : undefined}
          className="min-w-0 flex-1 truncate text-[11.5px] font-semibold uppercase tracking-[0.06em] text-white"
        >
          {title}
        </span>
        {justUpdated && (
          <span className="hidden shrink-0 items-center gap-1 border border-accent bg-accent/20 px-1.5 py-px font-mono text-[8.5px] font-bold uppercase leading-none tracking-[0.14em] text-accent animate-pulse @[180px]:flex">
            <Sparkles className="h-2.5 w-2.5" />
            UPDATED
          </span>
        )}
        <span className="hidden shrink-0 border border-teal/35 px-1 py-px font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.12em] text-teal @[220px]:inline-flex">
          {tag}
        </span>
        <div
          className="slate-actions ml-1 flex shrink-0 items-center gap-0.5"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <span
            className={cn(
              'hidden items-center gap-0.5',
              showBody ? '@[220px]:flex' : 'group-hover/slate:@[220px]:flex'
            )}
          >
            {actions}
            {onPin && (
              <button
                type="button"
                onClick={onPin}
                title="Put on board"
                className="p-0.5 text-dim transition-colors hover:text-accent cursor-pointer"
              >
                <Layers className="h-3 w-3" />
              </button>
            )}
            {onShowInPanel && (
              <button
                type="button"
                onClick={onShowInPanel}
                title="Show in chat panel"
                className="p-0.5 text-dim transition-colors hover:text-white cursor-pointer"
              >
                <PanelRight className="h-3 w-3" />
              </button>
            )}
            {onOpenData && (
              <button
                type="button"
                onClick={onOpenData}
                title="Open in Data"
                className="p-0.5 text-dim transition-colors hover:text-white cursor-pointer"
              >
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
            {onOpenIn && (
              <button
                type="button"
                onClick={onOpenIn}
                title="Open in another view…"
                className="p-0.5 text-dim transition-colors hover:text-accent cursor-pointer"
              >
                <AppWindow className="h-3 w-3" />
              </button>
            )}
          </span>
          <button
            type="button"
            onClick={toggleMaximize}
            title={maximized ? `Restore slate (${focusKey} / Esc)` : `Maximize slate (${focusKey})`}
            className={cn(
              'p-0.5 transition-colors cursor-pointer',
              maximized ? 'text-accent hover:text-white' : 'text-dim hover:text-white'
            )}
          >
            {maximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              title="Close / Remove"
              className="p-0.5 text-dim transition-colors hover:text-alert cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

        {showBody && (
          <InsideSlateContext.Provider value={true}>
            <div
              data-slate-body
              className={cn(
                'flex flex-col gap-2.5 overflow-y-auto px-3.5 py-3',
                hasFixedHeight ? 'min-h-0 flex-1' : 'max-h-[420px]',
                interacting && 'pointer-events-none select-none'
              )}
            >
              {children}
            </div>
          </InsideSlateContext.Provider>
        )}
      </div>

      {/* Direct resize handles for expanded slates in Tabletop mode (outside .notch-sm clip-path) */}
      {expanded && !maximized && !fillCell &&
        onResizePointerDown &&
        RESIZE_HANDLES.map((h) => (
          <div
            key={h.edge}
            title={h.title}
            onPointerDown={(e) => onResizePointerDown(e, h.edge)}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            onPointerCancel={onResizePointerCancel}
            className={h.box}
          >
            <span className={h.grip} />
          </div>
        ))}
    </motion.div>
  )

  if (maximized) {
    return createPortal(
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
        onClick={(e) => {
          if (e.target === e.currentTarget) toggleMaximize()
        }}
        className="pointer-events-auto fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-3 backdrop-blur-md"
      >
        <div className="relative h-full w-full">
          {slateBody}
          <div className="pointer-events-none fixed inset-3 overflow-hidden">
            <div
              className="h-14 w-full bg-gradient-to-b from-transparent via-accent/20 to-transparent"
              style={{ animation: 'seven-focus-scan 170ms cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
            />
            {FOCUS_RETICLES.map((corner, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0.9, scale: 1.35 }}
                animate={{ opacity: 0.45, scale: 1 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className={cn('absolute h-3 w-3 border-accent', corner)}
              />
            ))}
          </div>
        </div>
      </motion.div>,
      document.body
    )
  }

  return (
    <>
      {slateBody}
      {returnEcho &&
        createPortal(
          <motion.div
            initial={{ opacity: 0.45, x: 0, y: 0, scaleX: 1, scaleY: 1 }}
            animate={{ opacity: 0, ...focusFlipFromRect(returnEcho) }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none fixed inset-3 z-[200] border border-accent/60 bg-accent/5 shadow-[0_0_24px_color-mix(in_srgb,var(--color-accent)_22%,transparent)]"
          />,
          document.body
        )}
    </>
  )
}

export function EntrySlate({
  kind,
  id,
  part,
  mode = 'slate',
  onToggleExpand,
  onRemove,
  onOpenData
}: EntrySlateProps) {
  const [localExpanded, setLocalExpanded] = useState(mode !== 'token')
  const expanded = onToggleExpand ? mode !== 'token' : localExpanded
  const toggle = onToggleExpand ?? (() => setLocalExpanded((v) => !v))

  const link = `@${kind}:${id}${part ? `#${part}` : ''}`
  const preview = useEntryPreview(link)
  const resolvedKind = preview && !('missing' in preview) ? preview.kind : kind
  const resolvedId = preview && !('missing' in preview) ? preview.id : id
  const { Chat, Thumb } = presentOf(resolvedKind)

  const title = preview && !('missing' in preview) ? showName(preview.title) : showName(id)
  const tag = preview && !('missing' in preview) ? preview.label : kind
  const subtitle = preview && !('missing' in preview) ? preview.line : undefined
  const openData = onOpenData ?? (() => showInData({ kind: resolvedKind, id: resolvedId }))
  const inspectInChat = () => void showInPanel(`${resolvedKind}/${resolvedId}`, part || null)

  const thumbNode =
    preview && !('missing' in preview) && preview.image ? (
      <AssetMedia id={preview.image} className="h-full w-full object-cover" />
    ) : Thumb ? (
      <Thumb id={resolvedId} />
    ) : undefined

  const insideSlate = useContext(InsideSlateContext)
  const fields = preview && !('missing' in preview) ? (preview.fields ?? []) : []
  const cardBody = preview && !('missing' in preview) ? preview.card.trim() : ''
  const hasCustomChat = Boolean(Chat && Chat !== EntrySlate)

  const content =
    hasCustomChat && Chat ? (
      <Chat kind={resolvedKind} id={resolvedId} part={part} />
    ) : (
      <>
        {preview && !('missing' in preview) && preview.image && (
          <div className="max-h-64 overflow-hidden border border-line/50 bg-black/50">
            <AssetMedia id={preview.image} className="h-full w-full object-cover" />
          </div>
        )}
        {subtitle && <div className="font-mono text-[11px] text-dim">{subtitle}</div>}
        {fields.length > 0 && (
          <Facts
            rows={fields.map((f): [string, ReactNode] => [
              f.name,
              <Markdown key={f.name} text={f.text} />
            ])}
          />
        )}
        {cardBody && fields.length === 0 && (
          <div className="text-[12.5px] leading-relaxed text-white/90">
            <Markdown text={cardBody} />
          </div>
        )}
        {preview && 'missing' in preview && (
          <div className="font-mono text-[11px] text-dim">{preview.missing}</div>
        )}
        {!preview && <div className="font-mono text-[11px] text-dim">Loading…</div>}
      </>
    )

  if (insideSlate) return content

  const openSurfaceMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    openMenu(
      { preventDefault() {}, stopPropagation() {}, clientX: r.left, clientY: r.bottom + 4 },
      title,
      slateSurfaceMenuItems({
        entryKind: resolvedKind,
        entryId: resolvedId,
        entryPart: part || null,
        onPin: () => void pinToChatTable(resolvedKind, resolvedId, title)
      })
    )
  }

  return (
    <SlateContainer
      title={title}
      tag={tag}
      subtitle={subtitle}
      thumb={thumbNode}
      entryKey={`${resolvedKind}/${resolvedId}`}
      expanded={expanded}
      onToggleExpand={toggle}
      onPin={() => void pinToChatTable(resolvedKind, resolvedId, title)}
      onShowInPanel={inspectInChat}
      onOpenData={openData}
      onOpenIn={openSurfaceMenu}
      onRemove={onRemove}
    >
      {content}
    </SlateContainer>
  )
}

setDefaultEntrySlate(EntrySlate)
