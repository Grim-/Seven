import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import ReactGridLayout, { useContainerWidth, type Layout } from 'react-grid-layout'
import {
  AppWindow,
  ArrowRightLeft,
  Eye,
  Layers,
  Maximize2,
  MessageSquareQuote,
  Minimize2,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X
} from 'lucide-react'
import type { CollectionViewKind, Dashboard, Widget } from '@shared/types'
import { GRID_COLS, SIZE_PRESETS, VIEW_LABELS, type SizePreset } from '@shared/widgets'
import { showName } from '@shared/ids'
import { engine } from '../../lib/ipc'
import { IN_APP } from '../../lib/mode'
import { openSevenLink } from '../../lib/links'
import { referenceInChat } from '../../lib/conversation'
import { droppedEntries, isEntryDrag } from '../../lib/entryDrag'
import { useFileDrop } from '../../lib/useFileDrop'
import { importPaths } from '../../lib/importFiles'
import { useEscapeLayer } from '../../lib/escape'
import { entryLink } from '../../store/data'
import { matchesKeybind, useKeybindLabel } from '../../store/keybinds'
import { useChatViewSwitcher } from '../../lib/chatViewMode'
import { toast } from '../../store/toasts'
import { errorText } from '../../lib/format'
import { failed } from '../../lib/notify'
import { widgetUi } from '../../registries/widgets'
import { askText, DropOverlay, openMenu } from '../ui'
import { ViewSwitcher } from '../data/CollectionView'
import { AssetMedia } from '../pictures/AssetMedia'
import { useEntryPreview } from '../entries/entryPreview'
import { SlateContainer, type SlateResizeEdge } from '../entries/EntrySlate'
import { showInPanel, showWidgetInPanel, slateSurfaceMenuItems } from '../data/showInPanel'
import {
  updateWidgetTokenPose,
  useBoardSurfaces,
  usePendingBoardPlacement,
  useSurfaceSwitcher,
  useTabletopInsets,
  useWidgetTokenPoses,
  type BoardLayoutMode,
  type SurfaceTopSlot,
  type WidgetTokenPose
} from '../chat/tabletopStore'
import { fileThings, placeOnBoard } from './AddPicker'
import { WidgetBody } from './WidgetBody'
import { WidgetEditor } from './WidgetEditor'
import { cn } from '../../lib/cn'

const CARD_W = 192
const CARD_H = 128
const GAP = 16
const MIN_SLATE_W = 92
const MIN_SLATE_H = 110
const SAFE_PAD = 8
const SLATE_COLLAPSED_W = 288
const SLATE_HEADER_H = 34

const EDGE_AXES: Record<SlateResizeEdge, { left?: boolean; right?: boolean; bottom?: boolean }> = {
  l: { left: true },
  r: { right: true },
  b: { bottom: true },
  bl: { left: true, bottom: true },
  br: { right: true, bottom: true }
}

function usableCanvas(
  bounds: { w: number; h: number } | null,
  bottomInset = 0
): { w: number; h: number } | null {
  if (!bounds) return null
  return {
    w: bounds.w,
    h: Math.max(SLATE_HEADER_H + SAFE_PAD * 2, bounds.h - Math.max(0, bottomInset))
  }
}

function clampPose(
  x: number,
  y: number,
  w: number,
  h: number,
  bounds: { w: number; h: number } | null,
  expanded: boolean,
  bottomInset = 0
): { x: number; y: number; w: number; h: number } {
  const usable = usableCanvas(bounds, bottomInset)
  const maxAllowedW = usable && usable.w > MIN_SLATE_W + SAFE_PAD * 2 ? usable.w - SAFE_PAD * 2 : 1600
  const maxAllowedH = usable && usable.h > MIN_SLATE_H + SAFE_PAD * 2 ? usable.h - SAFE_PAD * 2 : 960
  const clampedW = Math.min(maxAllowedW, Math.max(MIN_SLATE_W, Math.round(w)))
  const clampedH = Math.min(maxAllowedH, Math.max(MIN_SLATE_H, Math.round(h)))
  const boxW = expanded
    ? clampedW
    : usable
      ? Math.min(SLATE_COLLAPSED_W, Math.max(160, usable.w - SAFE_PAD * 2))
      : SLATE_COLLAPSED_W
  // Always keep the slate's top bar completely inside the visible safe band (below agent top bar, above user bottom bar).
  const maxX = usable ? Math.max(SAFE_PAD, usable.w - boxW - SAFE_PAD) : 1600
  const maxY = usable ? Math.max(SAFE_PAD, usable.h - SLATE_HEADER_H - SAFE_PAD) : 900
  return {
    x: Math.min(maxX, Math.max(SAFE_PAD, Math.round(x))),
    y: Math.min(maxY, Math.max(SAFE_PAD, Math.round(y))),
    w: clampedW,
    h: clampedH
  }
}

function resolvePose(
  pose: WidgetTokenPose,
  bounds: { w: number; h: number } | null,
  bottomInset = 0
): { x: number; y: number; w: number; h: number } {
  const usable = usableCanvas(bounds, bottomInset)
  const base = clampPose(pose.x, pose.y, pose.w, pose.h, bounds, pose.expanded, bottomInset)
  if (!usable) return base

  const boxW = pose.expanded
    ? base.w
    : Math.min(SLATE_COLLAPSED_W, Math.max(160, usable.w - SAFE_PAD * 2))
  const maxX = Math.max(SAFE_PAD, usable.w - boxW - SAFE_PAD)
  const maxY = Math.max(SAFE_PAD, usable.h - SLATE_HEADER_H - SAFE_PAD)
  const travelX = Math.max(0, maxX - SAFE_PAD)
  const travelY = Math.max(0, maxY - SAFE_PAD)

  let nextX = pose.x
  if (pose.rx !== undefined && (pose.refW === undefined || Math.abs(usable.w - pose.refW) > 2)) {
    nextX = SAFE_PAD + pose.rx * travelX
  } else if (pose.rx === undefined && pose.x > maxX && travelX > 0) {
    // Preserve relative spread across the narrower canvas when legacy saved poses come from a wider sidebar-hidden layout.
    const inferredRefW = Math.max(usable.w + 288, pose.x + boxW + SAFE_PAD * 2)
    const inferredTravelX = Math.max(1, inferredRefW - boxW - SAFE_PAD * 2)
    const rx = Math.min(1, Math.max(0, (pose.x - SAFE_PAD) / inferredTravelX))
    nextX = SAFE_PAD + rx * travelX
  }

  let nextY = pose.y
  if (pose.ry !== undefined && (pose.refH === undefined || Math.abs(usable.h - pose.refH) > 2)) {
    nextY = SAFE_PAD + pose.ry * travelY
  }

  return clampPose(nextX, nextY, pose.w, pose.h, bounds, pose.expanded, bottomInset)
}

const PRESET_GRID_LINES = {
  backgroundImage:
    'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
  backgroundSize: 'calc(100% / 12) 100%, 100% calc(100% / 5)'
} as const

function SizePresetGrid({
  activeW,
  activeH,
  onPick,
  onClose
}: {
  activeW: number
  activeH: number
  onPick: (preset: SizePreset) => void
  onClose: () => void
}) {
  return (
    <div className="grid w-[312px] grid-cols-3 gap-1.5 p-2">
      {SIZE_PRESETS.map((preset) => {
        const wPct = Math.max(8, Math.round((preset.w / GRID_COLS) * 1000) / 10)
        const hPct = Math.max(18, Math.round((Math.min(10, preset.h) / 10) * 1000) / 10)
        const active = preset.w === activeW && preset.h === activeH
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => {
              onClose()
              onPick(preset)
            }}
            className={cn(
              'group flex flex-col gap-1 border p-1.5 text-left transition-colors cursor-pointer',
              active
                ? 'border-accent bg-accent/15 text-white'
                : 'border-line/55 bg-bg-0/65 text-dim hover:border-accent/70 hover:bg-accent/10 hover:text-white'
            )}
          >
            <div
              style={PRESET_GRID_LINES}
              className="relative h-9 w-full overflow-hidden border border-line/45 bg-[#04090e]/90"
            >
              <div
                style={{ width: `${wPct}%`, height: `${hPct}%` }}
                className={cn(
                  'border-r border-b transition-colors',
                  active
                    ? 'border-accent bg-accent/45 shadow-[0_0_8px_color-mix(in_srgb,var(--color-accent)_40%,transparent)]'
                    : 'border-accent/75 bg-accent/25 group-hover:border-accent group-hover:bg-accent/35'
                )}
              />
            </div>
            <div className="flex items-baseline justify-between gap-1 font-mono leading-none">
              <span className={cn('text-[10.5px] font-bold', active ? 'text-accent' : 'text-white')}>
                {preset.w}×{preset.h}
              </span>
              <span className="truncate text-[8.5px] uppercase tracking-wider text-dim">{preset.label}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function WidgetSlate({
  dashboard,
  widget,
  index,
  pose,
  bounds,
  bottomInset = 0,
  slots,
  inGrid = false,
  compact = false,
  active = false,
  maximized,
  onFocusSlate,
  onToggleMaximize,
  onSettings
}: {
  dashboard: Dashboard
  widget: Widget
  index: number
  pose: WidgetTokenPose
  bounds: { w: number; h: number } | null
  bottomInset?: number
  slots: SurfaceTopSlot[]
  inGrid?: boolean
  compact?: boolean
  active?: boolean
  maximized: boolean
  onFocusSlate?: () => void
  onToggleMaximize: () => void
  onSettings: () => void
}) {
  const ui = widgetUi(widget.source)
  const entry =
    ui.entry?.(widget.source) ??
    (typeof widget.source.id === 'string' ? `${widget.source.kind}/${widget.source.id}` : null)
  const slash = entry ? entry.indexOf('/') : -1
  const entryKind = entry && slash > 0 ? entry.slice(0, slash) : null
  const entryId = entry && slash > 0 ? entry.slice(slash + 1) : null
  const entryPart = typeof widget.source.part === 'string' ? widget.source.part : null
  const link = entryKind && entryId ? `@${entryKind}:${entryId}` : ''
  const preview = useEntryPreview(link)
  const tag = preview && !('missing' in preview) ? preview.label : widget.source.kind
  const subtitle = preview && !('missing' in preview) ? preview.line : undefined
  const switchViews = ui.switchViews?.(widget) ?? []

  const [interacting, setInteracting] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const slateRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const dragRef = useRef<{
    startX: number
    startY: number
    origX: number
    origY: number
    origW: number
    origH: number
    curX: number
    curY: number
    moved: boolean
  } | null>(null)
  const resizeRef = useRef<{
    edge: SlateResizeEdge
    startX: number
    startY: number
    origX: number
    origY: number
    origW: number
    origH: number
    curX: number
    curY: number
    curW: number
    curH: number
    moved: boolean
  } | null>(null)

  const safeCanvas = usableCanvas(bounds, bottomInset)
  const clampedSaved = resolvePose(pose, bounds, bottomInset)
  const currentX = clampedSaved.x
  const currentY = clampedSaved.y
  const currentW = clampedSaved.w
  const currentH = clampedSaved.h

  const applyLiveGeometry = () => {
    const r = resizeRef.current
    const d = dragRef.current
    if (r) {
      if (wrapRef.current) wrapRef.current.style.left = `${r.curX}px`
      if (slateRef.current) {
        slateRef.current.style.width = `${r.curW}px`
        slateRef.current.style.height = `${r.curH}px`
      }
      return
    }
    if (d?.moved && wrapRef.current) {
      wrapRef.current.style.left = `${d.curX}px`
      wrapRef.current.style.top = `${d.curY}px`
    }
  }

  const scheduleGeometry = () => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      applyLiveGeometry()
    })
  }

  const flushRaf = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }

  // Re-assert live drag/resize geometry if a parent state update re-renders mid-gesture.
  useLayoutEffect(() => {
    applyLiveGeometry()
  })

  useEffect(() => () => flushRaf(), [])

  const remove = () =>
    void engine('widgets.remove', { dashboardId: dashboard.id, widgetId: widget.id }).catch(
      failed('Could not remove')
    )

  const updateWidget = (patch: { title?: string; view?: string }) =>
    void engine('widgets.update', { dashboardId: dashboard.id, widgetId: widget.id, ...patch }).catch(
      failed('Could not change')
    )

  const resizeGridPreset = (preset: { w: number; h: number }) => {
    if (inGrid) {
      void engine('widgets.layout', {
        dashboardId: dashboard.id,
        layouts: dashboard.widgets.map((w) => ({
          id: w.id,
          ...w.layout,
          ...(w.id === widget.id ? { w: Math.min(GRID_COLS, preset.w), h: preset.h } : {})
        }))
      }).catch(failed('Could not resize'))
    } else {
      const next = clampPose(currentX, currentY, preset.w * 92, preset.h * 64, bounds, true, bottomInset)
      updateWidgetTokenPose(
        dashboard.id,
        widget.id,
        { w: next.w, h: next.h, expanded: true },
        index,
        widget,
        safeCanvas
      )
    }
  }

  const openInData = () => entry && openSevenLink(`seven:${entry}`)

  const showInOutputs = () => {
    if (entryKind && entryId) {
      return void showInPanel(`${entryKind}/${entryId}`, entryPart, {
        dashboardId: dashboard.id,
        widgetId: widget.id,
        title: widget.title,
        dashboardName: dashboard.name
      })
    }
    return void showWidgetInPanel(dashboard, widget)
  }

  const surfaceOptions = () =>
    slateSurfaceMenuItems({
      entryKind,
      entryId,
      entryPart,
      dashboard,
      widget,
      onToggleMaximize,
      maximized
    })

  const toggleExpand = () => {
    if (inGrid) return
    updateWidgetTokenPose(
      dashboard.id,
      widget.id,
      { expanded: !pose.expanded },
      index,
      widget,
      safeCanvas
    )
  }

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if (inGrid) return
    if (e.button !== 0) return
    if ((e.target as HTMLElement | null)?.closest('button, a, input, textarea')) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: currentX,
      origY: currentY,
      origW: currentW,
      origH: currentH,
      curX: currentX,
      curY: currentY,
      moved: false
    }
  }

  const onHeaderPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      d.moved = true
      setInteracting(true)
    }
    if (d.moved) {
      const next = clampPose(d.origX + dx, d.origY + dy, d.origW, d.origH, bounds, pose.expanded, bottomInset)
      if (next.x !== d.curX || next.y !== d.curY) {
        d.curX = next.x
        d.curY = next.y
        scheduleGeometry()
      }
    }
  }

  const finishHeaderDrag = (e: React.PointerEvent, canceled: boolean) => {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    flushRaf()
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    setInteracting(false)
    if (canceled) {
      if (wrapRef.current) {
        wrapRef.current.style.left = `${currentX}px`
        wrapRef.current.style.top = `${currentY}px`
      }
      return
    }
    if (d.moved) {
      if (wrapRef.current) {
        wrapRef.current.style.left = `${d.curX}px`
        wrapRef.current.style.top = `${d.curY}px`
      }
      updateWidgetTokenPose(dashboard.id, widget.id, { x: d.curX, y: d.curY }, index, widget, safeCanvas)
    } else {
      toggleExpand()
    }
  }

  const onHeaderPointerUp = (e: React.PointerEvent) => finishHeaderDrag(e, false)
  const onHeaderPointerCancel = (e: React.PointerEvent) => finishHeaderDrag(e, true)

  const onResizePointerDown = (e: React.PointerEvent, edge: SlateResizeEdge) => {
    if (inGrid || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setInteracting(true)
    resizeRef.current = {
      edge,
      startX: e.clientX,
      startY: e.clientY,
      origX: currentX,
      origY: currentY,
      origW: currentW,
      origH: currentH,
      curX: currentX,
      curY: currentY,
      curW: currentW,
      curH: currentH,
      moved: false
    }
  }

  const onResizePointerMove = (e: React.PointerEvent) => {
    const r = resizeRef.current
    if (!r) return
    const axis = EDGE_AXES[r.edge]
    const dx = e.clientX - r.startX
    const dy = e.clientY - r.startY
    const usable = usableCanvas(bounds, bottomInset)

    let nextX = r.origX
    let nextW = r.origW
    if (axis.left) {
      const origRight = r.origX + r.origW
      const maxWFromLeft = Math.max(r.origW, origRight - SAFE_PAD)
      nextW = Math.min(maxWFromLeft, Math.max(MIN_SLATE_W, Math.round(r.origW - dx)))
      nextX = origRight - nextW
    } else if (axis.right) {
      const maxWFromRight = usable ? Math.max(r.origW, usable.w - r.origX - SAFE_PAD) : 1600
      nextW = Math.min(maxWFromRight, Math.max(MIN_SLATE_W, Math.round(r.origW + dx)))
    }

    let nextH = r.origH
    if (axis.bottom) {
      const maxUsableH = usable && usable.h > MIN_SLATE_H + SAFE_PAD * 2 ? usable.h - SAFE_PAD * 2 : 960
      const maxBoundsH = bounds ? Math.max(r.origH, bounds.h - r.origY - SAFE_PAD) : maxUsableH
      const maxH = Math.max(r.origH, Math.min(maxUsableH, maxBoundsH))
      nextH = Math.min(maxH, Math.max(MIN_SLATE_H, Math.round(r.origH + dy)))
    }

    if (nextX !== r.curX || nextW !== r.curW || nextH !== r.curH) {
      r.curX = nextX
      r.curW = nextW
      r.curH = nextH
      r.moved = true
      scheduleGeometry()
    }
  }

  const finishResize = (e: React.PointerEvent, canceled: boolean) => {
    const r = resizeRef.current
    if (!r) return
    resizeRef.current = null
    flushRaf()
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    setInteracting(false)
    if (canceled || !r.moved) {
      if (wrapRef.current) wrapRef.current.style.left = `${currentX}px`
      if (slateRef.current) {
        slateRef.current.style.width = `${currentW}px`
        slateRef.current.style.height = `${currentH}px`
      }
      return
    }
    if (wrapRef.current) wrapRef.current.style.left = `${r.curX}px`
    if (slateRef.current) {
      slateRef.current.style.width = `${r.curW}px`
      slateRef.current.style.height = `${r.curH}px`
    }
    updateWidgetTokenPose(
      dashboard.id,
      widget.id,
      {
        ...(EDGE_AXES[r.edge].left ? { x: r.curX } : {}),
        w: r.curW,
        h: r.curH
      },
      index,
      widget,
      safeCanvas
    )
  }

  const onResizePointerUp = (e: React.PointerEvent) => finishResize(e, false)
  const onResizePointerCancel = (e: React.PointerEvent) => finishResize(e, true)

  const moveToSurface = (surfaceId: string) => {
    updateWidgetTokenPose(dashboard.id, widget.id, { surfaceId }, index, widget, safeCanvas)
    const target = slots.find((s) => s.id === surfaceId)
    if (target) toast.info('Moved slate', `${showName(widget.title)} → ${target.index}: ${target.label}`)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea, iframe')) return
    e.stopPropagation()
    const otherSlots = slots.filter((s) => s.id !== pose.surfaceId)
    openMenu(e, widget.title, [
      ...(!inGrid
        ? [
            {
              label: pose.expanded ? 'Collapse slate' : 'Expand slate',
              icon: pose.expanded ? <Minimize2 /> : <Maximize2 />,
              onSelect: toggleExpand
            }
          ]
        : []),
      {
        label: maximized ? 'Restore size' : 'Maximize slate',
        icon: maximized ? <Minimize2 /> : <Maximize2 />,
        onSelect: onToggleMaximize
      },
      {
        label: 'Size preset',
        icon: <Maximize2 />,
        submenuTitle: 'Size · 12-Col Layout',
        submenu: (close) => (
          <SizePresetGrid
            activeW={inGrid ? widget.layout.w : Math.round(currentW / 92)}
            activeH={inGrid ? widget.layout.h : Math.round(currentH / 64)}
            onPick={resizeGridPreset}
            onClose={close}
          />
        )
      },
      ...(switchViews.length
        ? [
            {
              label: 'View',
              icon: <Eye />,
              children: switchViews.map((v) => ({
                label: `${VIEW_LABELS[v] ?? v}${widget.view === v ? '  ✓' : ''}`,
                onSelect: () => updateWidget({ view: v })
              }))
            }
          ]
        : []),
      ...(otherSlots.length > 0
        ? [
            {
              label: 'Move to SurfaceTop',
              icon: <ArrowRightLeft />,
              children: otherSlots.map((s) => ({
                label: `${s.index} · ${s.label}`,
                icon: <Layers />,
                onSelect: () => moveToSurface(s.id)
              }))
            }
          ]
        : []),
      {
        label: 'Rename…',
        icon: <Pencil />,
        onSelect: () =>
          askText('Rename Slate', 'Title', widget.title, (val) => {
            if (val.trim()) updateWidget({ title: val.trim() })
          })
      },
      { label: 'Settings', icon: <Settings2 />, onSelect: onSettings },
      ...(entryKind && entryId
        ? [
            {
              label: 'Reference in chat',
              icon: <MessageSquareQuote />,
              onSelect: () => referenceInChat(entryLink(entryKind, entryId))
            }
          ]
        : []),
      {
        label: 'Open in…',
        icon: <AppWindow />,
        children: surfaceOptions()
      },
      { label: '', separator: true },
      { label: 'Remove from board', icon: <Trash2 />, danger: true, onSelect: remove }
    ])
  }

  const thumb =
    !pose.expanded && !inGrid && preview && !('missing' in preview) && preview.image ? (
      <AssetMedia id={preview.image} className="h-full w-full object-cover" />
    ) : undefined

  const slateNode = (
    <SlateContainer
      title={showName(widget.title)}
      tag={tag}
      subtitle={subtitle}
      thumb={thumb}
      entryKey={entryKind && entryId ? `${entryKind}/${entryId}` : undefined}
      expanded={inGrid ? true : pose.expanded}
      maximized={maximized}
      width={!inGrid && pose.expanded ? currentW : undefined}
      height={!inGrid && pose.expanded ? currentH : undefined}
      fillCell={inGrid}
      interacting={interacting}
      slateRef={inGrid ? undefined : slateRef}
      onToggleExpand={inGrid ? undefined : toggleExpand}
      onToggleMaximize={onToggleMaximize}
      onHeaderPointerDown={inGrid ? undefined : onHeaderPointerDown}
      onHeaderPointerMove={inGrid ? undefined : onHeaderPointerMove}
      onHeaderPointerUp={inGrid ? undefined : onHeaderPointerUp}
      onHeaderPointerCancel={inGrid ? undefined : onHeaderPointerCancel}
      onResizePointerDown={inGrid ? undefined : onResizePointerDown}
      onResizePointerMove={inGrid ? undefined : onResizePointerMove}
      onResizePointerUp={inGrid ? undefined : onResizePointerUp}
      onResizePointerCancel={inGrid ? undefined : onResizePointerCancel}
      onShowInPanel={showInOutputs}
      onOpenData={IN_APP && entry ? openInData : undefined}
      onOpenIn={(e) => {
        e.stopPropagation()
        const r = e.currentTarget.getBoundingClientRect()
        openMenu(
          { preventDefault() {}, stopPropagation() {}, clientX: r.left, clientY: r.bottom + 4 },
          showName(widget.title),
          surfaceOptions()
        )
      }}
      onRemove={remove}
      actions={
        <>
          {switchViews.length > 0 && !compact && (
            <ViewSwitcher
              compact
              value={widget.view as CollectionViewKind}
              onChange={(view) => updateWidget({ view })}
            />
          )}
          <button
            type="button"
            onClick={onSettings}
            title="Settings"
            className="p-1 text-dim transition-colors hover:text-white cursor-pointer"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </>
      }
    >
      <WidgetBody dashboard={dashboard} widget={widget} compact={compact} />
    </SlateContainer>
  )

  if (inGrid) {
    return (
      <div data-slate onContextMenu={handleContextMenu} className="pointer-events-auto h-full w-full">
        {slateNode}
      </div>
    )
  }

  return (
    <div
      ref={wrapRef}
      data-slate
      style={{ left: currentX, top: currentY }}
      onPointerDownCapture={onFocusSlate}
      onContextMenu={handleContextMenu}
      className={cn(
        'pointer-events-auto absolute',
        pose.expanded ? (active ? 'z-35' : 'z-30') : 'z-10'
      )}
    >
      {slateNode}
    </div>
  )
}

function SurfaceSwitcherModal({
  dashboard,
  poses,
  onClose
}: {
  dashboard: Dashboard
  poses: Record<string, WidgetTokenPose>
  onClose: () => void
}) {
  const { state, activeSlot, setActiveSurface, addSurfaceAt, renameSurface, removeSurface } = useBoardSurfaces(
    dashboard.id
  )
  const switcherKey = useKeybindLabel('tabletop.surfaceSwitcher')
  useEscapeLayer(true, onClose)

  useEffect(() => {
    useChatViewSwitcher.getState().setOpen(false)
  }, [])

  const { occupied, openNeighbors } = useMemo(() => {
    const occupied = new Map<string, SurfaceTopSlot>()
    for (const s of state.slots) {
      occupied.set(`${s.gx},${s.gy}`, s)
    }
    const openMap = new Map<string, { gx: number; gy: number }>()
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }
    ]
    for (const s of state.slots) {
      for (const { dx, dy } of dirs) {
        const nx = s.gx + dx
        const ny = s.gy + dy
        const key = `${nx},${ny}`
        if (!occupied.has(key) && !openMap.has(key)) {
          openMap.set(key, { gx: nx, gy: ny })
        }
      }
    }
    return { occupied, openNeighbors: [...openMap.values()] }
  }, [state.slots])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (e.key >= '0' && e.key <= '9' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const idx = Number(e.key)
        const match = state.slots.find((s) => s.index === idx)
        if (match) {
          e.preventDefault()
          setActiveSurface(match.id)
          onClose()
        }
        return
      }
      const delta =
        e.key === 'ArrowRight'
          ? { dx: 1, dy: 0 }
          : e.key === 'ArrowLeft'
            ? { dx: -1, dy: 0 }
            : e.key === 'ArrowUp'
              ? { dx: 0, dy: -1 }
              : e.key === 'ArrowDown'
                ? { dx: 0, dy: 1 }
                : null
      if (delta) {
        const neighbor = occupied.get(`${activeSlot.gx + delta.dx},${activeSlot.gy + delta.dy}`)
        if (neighbor) {
          e.preventDefault()
          setActiveSurface(neighbor.id)
        }
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.slots, activeSlot, occupied])

  const widgetsBySurface = useMemo(() => {
    const map = new Map<string, Widget[]>()
    for (const w of dashboard.widgets) {
      const sid = poses[w.id]?.surfaceId ?? '0'
      const resolved = state.slots.some((s) => s.id === sid) ? sid : '0'
      map.set(resolved, [...(map.get(resolved) ?? []), w])
    }
    return map
  }, [dashboard.widgets, poses, state.slots])

  return createPortal(
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="pointer-events-auto fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/88 backdrop-blur-md select-none"
    >
      <div className="pointer-events-none absolute top-5 flex items-center gap-3 border border-line/60 bg-black/85 px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-dim">
        <span className="font-bold text-accent">{dashboard.name}</span>
        <span>·</span>
        <span>SurfaceTop Overview</span>
        <span className="text-faint">({switcherKey !== 'Unbound' ? `${switcherKey} or ` : ''}Esc to close)</span>
      </div>

      <div className="relative h-0 w-0">
        {state.slots.map((slot) => {
          const isCurrent = slot.id === activeSlot.id
          const items = widgetsBySurface.get(slot.id) ?? []
          const left = slot.gx * (CARD_W + GAP) - CARD_W / 2
          const top = slot.gy * (CARD_H + GAP) - CARD_H / 2
          return (
            <button
              key={slot.id}
              type="button"
              style={{ left, top, width: CARD_W, height: CARD_H }}
              onClick={() => {
                setActiveSurface(slot.id)
                onClose()
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                openMenu(e, `${slot.index} · ${slot.label}`, [
                  {
                    label: 'Rename SurfaceTop…',
                    icon: <Pencil />,
                    onSelect: () =>
                      askText('Rename SurfaceTop', 'Name', slot.label, (val) => renameSurface(slot.id, val))
                  },
                  ...(slot.id !== '0'
                    ? [
                        {
                          label: 'Remove SurfaceTop',
                          icon: <Trash2 />,
                          danger: true,
                          onSelect: () => removeSurface(slot.id)
                        }
                      ]
                    : [])
                ])
              }}
              className={cn(
                'shell-slate group absolute flex flex-col justify-between p-2.5 text-left transition-all cursor-pointer',
                isCurrent
                  ? 'border-accent border-l-2 border-l-accent bg-accent/15 shadow-[0_0_24px_color-mix(in_srgb,var(--color-accent)_25%,transparent)]'
                  : 'hover:border-accent/70'
              )}
            >
              <div className="flex w-full items-center justify-between gap-1.5 border-b border-line/50 pb-1.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center border font-mono text-[11px] font-bold',
                      isCurrent
                        ? 'border-accent bg-accent text-black'
                        : 'border-line bg-black/60 text-accent-soft'
                    )}
                  >
                    {slot.index}
                  </span>
                  <span className="truncate font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-white">
                    {slot.label}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-[9.5px] text-faint">{items.length}</span>
              </div>

              <div className="relative my-1 flex min-h-0 flex-1 flex-wrap content-start gap-1 overflow-hidden">
                {items.length === 0 ? (
                  <span className="m-auto font-mono text-[10px] uppercase tracking-wider text-faint">
                    Empty surface
                  </span>
                ) : (
                  items.slice(0, 6).map((w) => (
                    <span
                      key={w.id}
                      className="max-w-full truncate border border-line/60 border-l-2 border-l-accent bg-black/75 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/85"
                    >
                      {showName(w.title)}
                    </span>
                  ))
                )}
                {items.length > 6 && (
                  <span className="px-1 font-mono text-[9px] text-dim">+{items.length - 6} more</span>
                )}
              </div>

              <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
                <span>{isCurrent ? 'Active' : 'Click to switch'}</span>
                {slot.id !== '0' && (
                  <span
                    role="button"
                    tabIndex={-1}
                    title="Remove SurfaceTop"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeSurface(slot.id)
                    }}
                    className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-alert"
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
              </div>
            </button>
          )
        })}

        {openNeighbors.map(({ gx, gy }) => {
          const left = gx * (CARD_W + GAP) - CARD_W / 2
          const top = gy * (CARD_H + GAP) - CARD_H / 2
          return (
            <button
              key={`add:${gx},${gy}`}
              type="button"
              style={{ left, top, width: CARD_W, height: CARD_H }}
              onClick={() => {
                addSurfaceAt(gx, gy)
                onClose()
              }}
              title="Add new SurfaceTop here"
              className="shell-add absolute flex flex-col items-center justify-center gap-1.5 bg-black/45 transition-all hover:bg-accent/10 cursor-pointer"
            >
              <Plus className="h-6 w-6" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]">
                New SurfaceTop
              </span>
            </button>
          )
        })}
      </div>
    </motion.div>,
    document.body
  )
}

export function BoardTabletop({
  dashboard,
  layoutMode = 'tabletop',
  compact = false
}: {
  dashboard: Dashboard
  layoutMode?: BoardLayoutMode
  compact?: boolean
}) {
  const poses = useWidgetTokenPoses(dashboard)
  const { state: surfaces, activeSlot } = useBoardSurfaces(dashboard.id)
  const switcherOpen = useSurfaceSwitcher((s) => s.open)
  const setSwitcherOpen = useSurfaceSwitcher((s) => s.setOpen)
  const toggleSwitcher = useSurfaceSwitcher((s) => s.toggle)
  const pendingPlacement = usePendingBoardPlacement((s) => s.pending)
  const setPendingPlacement = usePendingBoardPlacement((s) => s.setPending)
  const isPlacing = Boolean(pendingPlacement && pendingPlacement.dashboardId === dashboard.id)
  const [cursorPt, setCursorPt] = useState<{ x: number; y: number } | null>(null)
  const [configuring, setConfiguring] = useState<Widget | null>(null)
  const [maximizedWidgetId, setMaximizedWidgetId] = useState<string | null>(null)
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [bounds, setBounds] = useState<{ w: number; h: number } | null>(null)
  const bottomInset = useTabletopInsets((s) => s.bottom)
  const { width: gridWidth, containerRef: gridContainerRef, mounted: gridMounted } = useContainerWidth()

  useEscapeLayer(isPlacing, () => setPendingPlacement(null))

  useEffect(() => {
    const el = surfaceRef.current
    if (!el) return
    let raf = 0
    const apply = () => {
      raf = 0
      const w = el.clientWidth
      const h = el.clientHeight
      setBounds((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply)
    }
    apply()
    const observer = new ResizeObserver(schedule)
    observer.observe(el)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [])

  // Ctrl + Space shortcut to open/close the SurfaceTop Switcher
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (matchesKeybind('tabletop.surfaceSwitcher', e)) {
        e.preventDefault()
        toggleSwitcher()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleSwitcher])

  const validSurfaceIds = useMemo(() => new Set(surfaces.slots.map((s) => s.id)), [surfaces.slots])

  const visibleWidgets = useMemo(() => {
    return dashboard.widgets.flatMap((w, index) => {
      const rawPose = poses[w.id] ?? {
        x: 24,
        y: 36 + index * 64,
        w: 420,
        h: 320,
        expanded: false,
        surfaceId: '0'
      }
      const effectiveSurfaceId = validSurfaceIds.has(rawPose.surfaceId) ? rawPose.surfaceId : '0'
      if (effectiveSurfaceId !== activeSlot.id) return []
      return [{ widget: w, index, pose: { ...rawPose, surfaceId: effectiveSurfaceId } }]
    })
  }, [dashboard.widgets, poses, activeSlot.id, validSurfaceIds])

  const gridLayout = useMemo<Layout>(
    () =>
      visibleWidgets.map(({ widget: w }) => ({
        i: w.id,
        ...w.layout,
        minW: 1,
        minH: 1
      })),
    [visibleWidgets]
  )

  const persistGridLayout = (next: Layout) => {
    const byId = new Map(next.map((l) => [l.i, l]))
    const changed = dashboard.widgets.some((w) => {
      const l = byId.get(w.id)
      return l && (w.layout.x !== l.x || w.layout.y !== l.y || w.layout.w !== l.w || w.layout.h !== l.h)
    })
    if (!changed) return
    void engine('widgets.layout', {
      dashboardId: dashboard.id,
      layouts: dashboard.widgets.map((w) => {
        const l = byId.get(w.id)
        return l ? { id: w.id, x: l.x, y: l.y, w: l.w, h: l.h } : { id: w.id, ...w.layout }
      })
    }).catch((err) => toast.error('Could not save layout', errorText(err)))
  }

  const safeCanvas = usableCanvas(bounds, bottomInset)

  const toDropCoords = (clientX: number, clientY: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (!rect) return { x: 24, y: 48 }
    const clamped = clampPose(clientX - rect.left - 110, clientY - rect.top - 20, 420, 320, bounds, true, bottomInset)
    return { x: clamped.x, y: clamped.y }
  }

  const dropFiles = async (paths: string[], e: React.DragEvent) => {
    const pt = toDropCoords(e.clientX, e.clientY)
    try {
      const added = await importPaths(paths)
      await placeOnBoard(dashboard.id, fileThings(added), pt, undefined, safeCanvas)
    } catch (err) {
      toast.error('Could not add files', errorText(err))
    }
  }

  const fileDrop = useFileDrop((paths, e) => void dropFiles(paths, e), true)

  const handleEntryDrop = (e: React.DragEvent) => {
    if (!isEntryDrag(e)) return
    e.preventDefault()
    e.stopPropagation()
    const entries = droppedEntries(e)
    if (!entries.length) return
    const pt = toDropCoords(e.clientX, e.clientY)
    void placeOnBoard(dashboard.id, entries, pt, undefined, safeCanvas).catch(failed('Could not put on board'))
  }

  const isGrid = layoutMode === 'grid'
  const rowHeight = compact ? 34 : 46
  const margin = compact ? 8 : 12

  return (
    <div
      ref={surfaceRef}
      {...fileDrop.props}
      onDragOver={(e) => {
        fileDrop.props.onDragOver(e)
        if (isEntryDrag(e)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDrop={(e) => {
        if (isEntryDrag(e)) {
          handleEntryDrop(e)
          return
        }
        fileDrop.props.onDrop(e)
      }}
      style={isGrid && bottomInset > 0 ? { paddingBottom: bottomInset + 12 } : undefined}
      className={cn(
        'pointer-events-auto relative h-full w-full select-none',
        isGrid ? 'overflow-y-auto p-3' : 'overflow-hidden'
      )}
    >
      <DropOverlay show={fileDrop.over} label="Drop to put on this SurfaceTop" className="inset-0 bg-black/70" />

      <div
        key={`${activeSlot.id}:${layoutMode}`}
        className={isGrid ? 'pointer-events-auto relative z-25 min-h-full w-full' : 'pointer-events-none absolute inset-0'}
      >
        {isGrid ? (
          <div ref={gridContainerRef} className="min-h-full w-full">
            {gridMounted && gridWidth > 0 && (
              <ReactGridLayout
                width={gridWidth}
                layout={gridLayout}
                gridConfig={{
                  cols: GRID_COLS,
                  rowHeight,
                  margin: [margin, margin],
                  containerPadding: [0, 0]
                }}
                dragConfig={{
                  enabled: true,
                  handle: '.slate-drag-handle',
                  cancel: '.slate-actions, button, a, input, textarea'
                }}
                resizeConfig={{ enabled: true }}
                onDragStop={(next) => persistGridLayout(next)}
                onResizeStop={(next) => persistGridLayout(next)}
              >
                {visibleWidgets.map(({ widget, index, pose }) => (
                  <div key={widget.id}>
                    <WidgetSlate
                      dashboard={dashboard}
                      widget={widget}
                      index={index}
                      pose={pose}
                      bounds={bounds}
                      bottomInset={bottomInset}
                      slots={surfaces.slots}
                      inGrid
                      compact={compact}
                      active={activeWidgetId === widget.id}
                      onFocusSlate={() => setActiveWidgetId((cur) => (cur === widget.id ? cur : widget.id))}
                      maximized={maximizedWidgetId === widget.id}
                      onToggleMaximize={() =>
                        setMaximizedWidgetId((cur) => (cur === widget.id ? null : widget.id))
                      }
                      onSettings={() => setConfiguring(widget)}
                    />
                  </div>
                ))}
              </ReactGridLayout>
            )}
          </div>
        ) : (
          visibleWidgets.map(({ widget, index, pose }) => (
            <WidgetSlate
              key={widget.id}
              dashboard={dashboard}
              widget={widget}
              index={index}
              pose={pose}
              bounds={bounds}
              bottomInset={bottomInset}
              slots={surfaces.slots}
              compact={compact}
              active={activeWidgetId === widget.id}
              onFocusSlate={() => setActiveWidgetId((cur) => (cur === widget.id ? cur : widget.id))}
              maximized={maximizedWidgetId === widget.id}
              onToggleMaximize={() =>
                setMaximizedWidgetId((cur) => (cur === widget.id ? null : widget.id))
              }
              onSettings={() => setConfiguring(widget)}
            />
          ))
        )}
      </div>

      {isPlacing && pendingPlacement && (
        <div
          onMouseMove={(e) => setCursorPt(toDropCoords(e.clientX, e.clientY))}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const pt = toDropCoords(e.clientX, e.clientY)
            const current = pendingPlacement
            setPendingPlacement(null)
            setCursorPt(null)
            void current.commit(pt, safeCanvas).catch(failed('Could not place on board'))
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setPendingPlacement(null)
            setCursorPt(null)
          }}
          className="pointer-events-auto absolute inset-0 z-45 cursor-crosshair bg-accent/[0.03]"
        >
          <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 border border-accent/70 bg-black/90 px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent shadow-[0_8px_24px_rgba(0,0,0,0.85)]">
            Click anywhere on {activeSlot.index}: {activeSlot.label} to place{' '}
            <span className="font-bold text-white">{pendingPlacement.label}</span>
            <span className="ml-2 text-dim">(Esc or Right-click to cancel)</span>
          </div>
          {cursorPt && (
            <div
              style={{ left: cursorPt.x, top: cursorPt.y, width: 320 }}
              className="pointer-events-none absolute border border-dashed border-accent border-l-2 border-l-accent bg-[#060b10]/85 px-3 py-2 shadow-[0_0_24px_color-mix(in_srgb,var(--color-accent)_28%,transparent)] backdrop-blur-md"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-white">
                  {pendingPlacement.label}
                </span>
                <span className="border border-accent/50 bg-accent/15 px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-accent">
                  CLICK TO PLACE
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {switcherOpen && (
          <SurfaceSwitcherModal
            dashboard={dashboard}
            poses={poses}
            onClose={() => setSwitcherOpen(false)}
          />
        )}
      </AnimatePresence>

      {configuring && (
        <WidgetEditor dashboard={dashboard} widget={configuring} onClose={() => setConfiguring(null)} />
      )}
    </div>
  )
}
