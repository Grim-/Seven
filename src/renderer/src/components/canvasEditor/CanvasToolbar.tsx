import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Lock,
  Redo2,
  RotateCcw,
  Undo2,
  Unlock,
  X
} from 'lucide-react'
import { cn } from '../../lib/cn'
import { useViewPlace } from '../../lib/viewPlace'
import { openMenu } from '../ui/ContextMenu'
import { useCanvasEditor, useCanvasEditorStore } from './store'
import type { CanvasHistory, CanvasToolDef, ToolbarLayout } from './types'

const DEFAULT_LAYOUT: ToolbarLayout = {
  x: 0,
  y: 12,
  dock: 'top',
  locked: false,
  collapsed: false
}

const HOVER_CLOSE_DELAY_MS = 180

export type CanvasToolbarProps = {
  /** Unique toolbar ID inside this editor (persisted via `useViewPlace`). */
  toolbarId?: string
  tools: readonly CanvasToolDef[]
  /** Optional contextual options strip rendered right below the active horizontal bar. */
  optionsBar?: ReactNode
  /** Optional dropdown panel (e.g. Stamp picker) — keeping it open pins hover-reveal open. */
  dropdown?: ReactNode
  dropdownOpen?: boolean
  history?: CanvasHistory
  onSelectTool?: (toolId: string) => void
  className?: string
}

/**
 * Movable, Lockable, Single-Icon Collapsed + Hover-Reveal Horizontal Toolbar.
 * - Drag via GripVertical handle (4px threshold, clamped to parent bounds via ResizeObserver).
 * - Lock / Unlock prevents accidental dragging.
 * - Collapse shrinks to a single square active-tool icon button; hovering the icon reveals the
 *   full bar and stays open smoothly across the bar, options strip, and open dropdowns.
 * - Automatically displays a Multi-Stage Tool status pill (e.g. Linking Tool Stage 1/3 → 2/3 → 3/3).
 */
export function CanvasToolbar({
  toolbarId = 'primary',
  tools,
  optionsBar,
  dropdown,
  dropdownOpen = false,
  history,
  onSelectTool,
  className
}: CanvasToolbarProps) {
  const store = useCanvasEditorStore()
  const editorId = useCanvasEditor((s) => s.editorId)
  const fsm = useCanvasEditor((s) => s.fsm)

  const [savedLayout, setSavedLayout] = useViewPlace<ToolbarLayout>(
    `canvasToolbar.${editorId}.${toolbarId}`,
    DEFAULT_LAYOUT
  )
  const layout: ToolbarLayout = { ...DEFAULT_LAYOUT, ...savedLayout }

  const rootRef = useRef<HTMLDivElement>(null)
  const [livePos, setLivePos] = useState<{ x: number; y: number } | null>(null)
  const [hoverRevealed, setHoverRevealed] = useState(false)
  const leaveTimerRef = useRef<number | null>(null)

  const activeToolId = fsm.kind === 'tool_active' ? fsm.toolId : 'select'
  const activeTool = tools.find((t) => t.id === activeToolId) ?? tools[0]
  const activeStage =
    fsm.kind === 'tool_active' && activeTool?.stages?.length
      ? activeTool.stages[fsm.stage]
      : undefined

  // Clamp free-positioned toolbar inside parent container whenever container resizes
  useEffect(() => {
    const el = rootRef.current
    const parent = el?.parentElement
    if (!el || !parent || layout.dock !== 'free') return
    const clamp = () => {
      const maxX = Math.max(8, parent.clientWidth - el.offsetWidth - 8)
      const maxY = Math.max(8, parent.clientHeight - el.offsetHeight - 8)
      const clampedX = Math.max(8, Math.min(maxX, layout.x))
      const clampedY = Math.max(8, Math.min(maxY, layout.y))
      if (clampedX !== layout.x || clampedY !== layout.y) {
        setSavedLayout({ ...layout, x: clampedX, y: clampedY })
      }
    }
    clamp()
    const ro = new ResizeObserver(clamp)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [layout, setSavedLayout])

  // Clean up hover timer on unmount
  useEffect(() => {
    return () => {
      if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current)
    }
  }, [])

  const clearLeaveTimer = () => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
  }

  const handleSurfaceEnter = () => {
    clearLeaveTimer()
    if (layout.collapsed) setHoverRevealed(true)
  }

  const handleSurfaceLeave = () => {
    clearLeaveTimer()
    if (!layout.collapsed) return
    if (dropdownOpen) return
    leaveTimerRef.current = window.setTimeout(() => {
      setHoverRevealed(false)
      leaveTimerRef.current = null
    }, HOVER_CLOSE_DELAY_MS)
  }

  const updateLayout = (patch: Partial<ToolbarLayout>) => {
    const next = { ...layout, ...patch }
    setSavedLayout(next)
    store.getState().setToolbarLayout(toolbarId, next)
  }

  const handleGripPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (layout.locked || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const el = rootRef.current
    const parent = el?.parentElement
    if (!el || !parent) return

    const parentRect = parent.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const startClientX = e.clientX
    const startClientY = e.clientY
    const originX = elRect.left - parentRect.left
    const originY = elRect.top - parentRect.top
    let dragging = false
    let finalX = originX
    let finalY = originY

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startClientX
      const dy = ev.clientY - startClientY
      if (!dragging && Math.hypot(dx, dy) < 4) return
      dragging = true
      const maxX = Math.max(8, parent.clientWidth - el.offsetWidth - 8)
      const maxY = Math.max(8, parent.clientHeight - el.offsetHeight - 8)
      finalX = Math.max(8, Math.min(maxX, originX + dx))
      finalY = Math.max(8, Math.min(maxY, originY + dy))
      setLivePos({ x: finalX, y: finalY })
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setLivePos(null)
      if (dragging) {
        updateLayout({ dock: 'free', x: Math.round(finalX), y: Math.round(finalY) })
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const handleSelectTool = (toolId: string) => {
    if (onSelectTool) {
      onSelectTool(toolId)
    } else {
      store.getState().enterTool(toolId)
    }
  }

  const handleToolbarContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    // If a non-select tool is active, right-click on toolbar cancels/steps back just like on canvas
    if (fsm.kind === 'tool_active') {
      store.getState().stepBackToolStage()
      return
    }
    openMenu(e, 'Toolbar', [
      {
        label: layout.locked ? 'Unlock Toolbar Position' : 'Lock Toolbar Position',
        icon: layout.locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />,
        onSelect: () => updateLayout({ locked: !layout.locked })
      },
      {
        label: layout.collapsed ? 'Pin Toolbar Expanded' : 'Collapse to Single Icon (Hover Reveal)',
        icon: layout.collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />,
        onSelect: () => {
          setHoverRevealed(false)
          updateLayout({ collapsed: !layout.collapsed })
        }
      },
      { separator: true, label: '' },
      {
        label: 'Reset Toolbar Position',
        icon: <RotateCcw className="h-3.5 w-3.5" />,
        onSelect: () => updateLayout({ dock: 'top', x: 0, y: 12 })
      }
    ])
  }

  const isExpanded = !layout.collapsed || hoverRevealed || dropdownOpen

  const positionStyle: React.CSSProperties =
    livePos !== null
      ? { left: livePos.x, top: livePos.y }
      : layout.dock === 'free'
        ? { left: layout.x, top: layout.y }
        : layout.dock === 'bottom'
          ? { left: '50%', bottom: 12, transform: 'translateX(-50%)' }
          : { left: '50%', top: 10, transform: 'translateX(-50%)' }

  return (
    <div
      ref={rootRef}
      data-canvas-ui
      style={positionStyle}
      onPointerEnter={handleSurfaceEnter}
      onPointerLeave={handleSurfaceLeave}
      onContextMenuCapture={handleToolbarContextMenu}
      className={cn(
        'pointer-events-none absolute z-20 flex flex-col items-center gap-1.5 font-ui select-none',
        className
      )}
    >
      {/* COLLAPSED SINGLE-ICON TRIGGER OR EXPANDED HORIZONTAL BAR */}
      {!isExpanded ? (
        <button
          type="button"
          title={`${activeTool?.label ?? 'Tools'} — hover to expand toolbar`}
          onClick={() => setHoverRevealed(true)}
          className="pointer-events-auto flex h-9 w-9 items-center justify-center border border-accent/60 tone-panel-95 text-accent shadow-panel transition-colors hover:bg-accent/15 cursor-pointer"
        >
          {activeTool?.icon}
        </button>
      ) : (
        <div className="pointer-events-auto flex items-center border border-line/70 tone-panel-95 shadow-panel backdrop-blur-[var(--panel-blur)]">
          {/* DRAG GRIP HANDLE */}
          <button
            type="button"
            disabled={layout.locked}
            onPointerDown={handleGripPointerDown}
            title={layout.locked ? 'Toolbar locked (unlock to move)' : 'Drag to reposition toolbar'}
            className={cn(
              'flex h-8 w-5 items-center justify-center border-r border-line/35 text-faint transition-colors',
              layout.locked ? 'opacity-40 cursor-not-allowed' : 'hover:text-ink cursor-grab active:cursor-grabbing'
            )}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>

          {/* TOOL BUTTONS */}
          {tools.map((t, idx) => {
            const active = activeToolId === t.id
            const prevGroup = idx > 0 ? tools[idx - 1].group : t.group
            const groupBreak = idx > 0 && prevGroup !== t.group
            return (
              <button
                key={t.id}
                type="button"
                title={t.shortcut ? `${t.label} (${t.shortcut})` : t.label}
                onClick={() => handleSelectTool(t.id)}
                className={cn(
                  'flex h-8 items-center gap-1.5 border-r border-line/35 px-2.5 transition-colors cursor-pointer',
                  groupBreak && 'border-l-2 border-l-line/70',
                  active
                    ? 'bg-accent/20 text-accent shadow-[inset_0_-2px_0_var(--color-accent)]'
                    : 'text-dim hover:bg-ink/[0.06] hover:text-ink'
                )}
              >
                {t.icon && <span className="flex h-3.5 w-3.5 items-center [&>svg]:h-3.5 [&>svg]:w-3.5">{t.icon}</span>}
                <span className="font-label text-[10px] font-bold caps-5">{t.label}</span>
              </button>
            )
          })}

          {/* OPTIONAL UNDO / REDO CONTROLS */}
          {history && (
            <div className="flex items-center border-l border-line/50">
              <button
                type="button"
                disabled={!history.canUndo}
                onClick={() => history.undo()}
                title="Undo (Ctrl+Z)"
                className="flex h-8 w-7 items-center justify-center text-dim hover:text-ink disabled:opacity-35 cursor-pointer"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={!history.canRedo}
                onClick={() => history.redo()}
                title="Redo (Ctrl+Shift+Z)"
                className="flex h-8 w-7 items-center justify-center border-r border-line/35 text-dim hover:text-ink disabled:opacity-35 cursor-pointer"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* LOCK & COLLAPSE CONTROLS */}
          <button
            type="button"
            onClick={() => updateLayout({ locked: !layout.locked })}
            title={layout.locked ? 'Unlock toolbar position' : 'Lock toolbar position'}
            className={cn(
              'flex h-8 w-7 items-center justify-center border-r border-line/35 transition-colors cursor-pointer',
              layout.locked ? 'text-accent bg-accent/10' : 'text-faint hover:text-ink'
            )}
          >
            {layout.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
          </button>
          <button
            type="button"
            onClick={() => {
              const nextCollapsed = !layout.collapsed
              if (nextCollapsed) setHoverRevealed(false)
              updateLayout({ collapsed: nextCollapsed })
            }}
            title={layout.collapsed ? 'Pin toolbar open' : 'Collapse toolbar to hover-reveal icon'}
            className="flex h-8 w-7 items-center justify-center text-faint hover:text-ink transition-colors cursor-pointer"
          >
            {layout.collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {/* MULTI-STAGE TOOL PROGRESS BAR (e.g. Linking Tool: Stage 1/3 → 2/3 → 3/3) */}
      {fsm.kind === 'tool_active' && activeTool?.stages && activeStage && (
        <div className="pointer-events-auto flex items-center gap-2 border border-accent/60 tone-panel-95 px-2.5 py-1 text-[11px] text-ink shadow-panel">
          <span className="font-data text-[10px] font-bold text-accent">
            {fsm.stage + 1}/{activeTool.stages.length}
          </span>
          <span className="font-semibold text-ink">{activeStage.label}</span>
          {activeStage.hint && <span className="text-dim">· {activeStage.hint}</span>}
          <span className="text-[10px] text-faint">· Right-click / Esc steps back</span>
          <button
            type="button"
            onClick={() => store.getState().exitTool()}
            title="Cancel tool"
            className="ml-1 text-dim hover:text-ink cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* CONTEXTUAL OPTIONS BAR SLOT */}
      {isExpanded && optionsBar && (
        <div className="pointer-events-auto border border-line/60 tone-panel-95 px-2 py-1 shadow-panel">
          {optionsBar}
        </div>
      )}

      {/* ATTACHED TOOL DROPDOWN SLOT (stays open inside hover-bridge!) */}
      {dropdownOpen && dropdown && (
        <div className="pointer-events-auto border border-accent/60 border-l-2 border-l-accent tone-sidebar-95 shadow-panel backdrop-blur-[var(--panel-blur)]">
          {dropdown}
        </div>
      )}
    </div>
  )
}
