import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useViewPlace } from '../../lib/viewPlace'
import {
  CanvasStoreContext,
  createCanvasStore,
  type CanvasEditorStore,
  type CreateCanvasStoreOptions
} from './store'
import type { CanvasCommandDef, CanvasHistory, CanvasToolDef } from './types'

function isEditableTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null
  if (!node) return false
  return (
    node.tagName === 'INPUT' ||
    node.tagName === 'TEXTAREA' ||
    node.tagName === 'SELECT' ||
    node.isContentEditable
  )
}

export type CanvasEditorShellProps = {
  /** Unique identifier used for `useViewPlace` persistence of drawers & toolbars. */
  editorId: string
  /** Optionally pass an externally created store; otherwise one isolated store is created per instance. */
  store?: CanvasEditorStore
  storeOptions?: Omit<CreateCanvasStoreOptions, 'editorId'>
  /** Optional tool definitions for single-key tool shortcuts (guarded against focused inputs). */
  tools?: readonly CanvasToolDef[]
  /** Optional command definitions (Delete, Duplicate, Nudge, etc.). */
  commands?: readonly CanvasCommandDef[]
  history?: CanvasHistory
  /** Left panel (Layers / Hierarchy / Scene Graph). Omit to hide left drawer entirely. */
  leftTitle?: string
  leftPanel?: ReactNode
  leftHeaderExtra?: ReactNode
  defaultLeftWidth?: number
  minLeftWidth?: number
  maxLeftWidth?: number
  /** Right panel (Inspector / Properties). Decoupled from selection so collapsing keeps selection intact. */
  rightTitle?: string
  rightPanel?: ReactNode
  rightHeaderExtra?: ReactNode
  defaultRightWidth?: number
  minRightWidth?: number
  maxRightWidth?: number
  /** Central viewport slot (2D `CanvasStage2D`, Three.js `<canvas>`, or Image Editor canvas). */
  children: ReactNode
  className?: string
}

/**
 * Top-level reusable `CanvasEditorShell`:
 * - Provides an isolated per-instance `CanvasStoreContext`
 * - Collapsible & drag-resizable Left (Layers) and Right (Inspector) panels with persisted widths & edge reopen tabs
 * - Shortcut-guarded tool hotkeys + Undo/Redo (`Ctrl+Z` / `Ctrl+Shift+Z`) + custom commands
 */
export function CanvasEditorShell({
  editorId,
  store: externalStore,
  storeOptions,
  tools,
  commands,
  history,
  leftTitle = 'Layers',
  leftPanel,
  leftHeaderExtra,
  defaultLeftWidth = 260,
  minLeftWidth = 190,
  maxLeftWidth = 480,
  rightTitle = 'Inspector',
  rightPanel,
  rightHeaderExtra,
  defaultRightWidth = 380,
  minRightWidth = 280,
  maxRightWidth = 760,
  children,
  className
}: CanvasEditorShellProps) {
  const internalStore = useMemo(
    () => externalStore ?? createCanvasStore({ editorId, ...storeOptions }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [externalStore, editorId]
  )

  const [leftOpen, setLeftOpen] = useViewPlace<boolean>(`canvasShell.${editorId}.leftOpen`, true)
  const [leftWidth, setLeftWidth] = useViewPlace<number>(`canvasShell.${editorId}.leftWidth`, defaultLeftWidth)
  const [rightOpen, setRightOpen] = useViewPlace<boolean>(`canvasShell.${editorId}.rightOpen`, true)
  const [rightWidth, setRightWidth] = useViewPlace<number>(`canvasShell.${editorId}.rightWidth`, defaultRightWidth)

  const [liveLeftW, setLiveLeftW] = useState<number | null>(null)
  const [liveRightW, setLiveRightW] = useState<number | null>(null)
  const shellRef = useRef<HTMLDivElement>(null)

  // Global guarded shortcuts for tool switching, Undo/Redo, and custom commands
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target) || isEditableTarget(document.activeElement)) return
      const keyLower = e.key.toLowerCase()

      if ((e.ctrlKey || e.metaKey) && keyLower === 'z') {
        if (e.shiftKey) {
          if (history?.canRedo) {
            e.preventDefault()
            history.redo()
          }
        } else if (history?.canUndo) {
          e.preventDefault()
          history.undo()
        }
        return
      }

      if ((e.ctrlKey || e.metaKey) && keyLower === 'y' && history?.canRedo) {
        e.preventDefault()
        history.redo()
        return
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey && tools?.length) {
        const matchedTool = tools.find((t) => t.shortcut?.toLowerCase() === keyLower)
        if (matchedTool) {
          e.preventDefault()
          internalStore.getState().enterTool(matchedTool.id)
          return
        }
      }

      if (commands?.length) {
        for (const cmd of commands) {
          if (!cmd.shortcut) continue
          if (cmd.shortcut.toLowerCase() === keyLower && (!cmd.when || cmd.when())) {
            e.preventDefault()
            cmd.run()
            return
          }
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [internalStore, tools, commands, history])

  const startResize = (
    side: 'left' | 'right',
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = side === 'left' ? (liveLeftW ?? leftWidth) : (liveRightW ?? rightWidth)
    const minW = side === 'left' ? minLeftWidth : minRightWidth
    const maxW = side === 'left' ? maxLeftWidth : maxRightWidth
    let finalW = startW

    const onMove = (ev: PointerEvent) => {
      const delta = side === 'left' ? ev.clientX - startX : startX - ev.clientX
      finalW = Math.max(minW, Math.min(maxW, startW + delta))
      if (side === 'left') setLiveLeftW(finalW)
      else setLiveRightW(finalW)
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      if (side === 'left') {
        setLiveLeftW(null)
        setLeftWidth(finalW)
      } else {
        setLiveRightW(null)
        setRightWidth(finalW)
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const effectiveLeftW = liveLeftW ?? leftWidth
  const effectiveRightW = liveRightW ?? rightWidth

  return (
    <CanvasStoreContext.Provider value={internalStore}>
      <div
        ref={shellRef}
        className={cn('relative flex h-full min-h-0 w-full min-w-0 overflow-hidden font-ui', className)}
      >
        {/* LEFT DRAWER (LAYERS / HIERARCHY) */}
        {leftPanel &&
          (leftOpen ? (
            <>
              <aside
                style={{ width: effectiveLeftW }}
                className="flex h-full min-h-0 shrink-0 flex-col border-r border-line/60 tone-sidebar-95"
              >
                <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-line/50 px-2.5">
                  <span className="truncate font-label text-[10.5px] font-bold caps-8 text-accent-soft">
                    {leftTitle}
                  </span>
                  <div className="flex items-center gap-1">
                    {leftHeaderExtra}
                    <button
                      type="button"
                      title={`Collapse ${leftTitle}`}
                      onClick={() => setLeftOpen(false)}
                      className="flex h-6 w-6 items-center justify-center text-dim hover:text-ink cursor-pointer"
                    >
                      <PanelLeftClose className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">{leftPanel}</div>
              </aside>
              <div
                role="separator"
                aria-orientation="vertical"
                onPointerDown={(e) => startResize('left', e)}
                onDoubleClick={() =>
                  setLeftWidth(leftWidth === defaultLeftWidth ? Math.min(maxLeftWidth, defaultLeftWidth + 100) : defaultLeftWidth)
                }
                className="w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-accent/40"
              />
            </>
          ) : (
            <button
              type="button"
              title={`Expand ${leftTitle}`}
              onClick={() => setLeftOpen(true)}
              className="flex h-full w-7 shrink-0 flex-col items-center border-r border-line/60 tone-sidebar-95 pt-2.5 text-dim hover:text-accent cursor-pointer"
            >
              <PanelLeftOpen className="h-3.5 w-3.5" />
            </button>
          ))}

        {/* CENTER VIEWPORT SLOT */}
        <main className="relative min-h-0 min-w-0 flex-1">{children}</main>

        {/* RIGHT DRAWER (INSPECTOR) */}
        {rightPanel &&
          (rightOpen ? (
            <>
              <div
                role="separator"
                aria-orientation="vertical"
                onPointerDown={(e) => startResize('right', e)}
                onDoubleClick={() =>
                  setRightWidth(rightWidth === defaultRightWidth ? Math.min(maxRightWidth, defaultRightWidth + 160) : defaultRightWidth)
                }
                className="w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-accent/40"
              />
              <aside
                style={{ width: effectiveRightW }}
                className="flex h-full min-h-0 shrink-0 flex-col border-l border-line/60 tone-sidebar-95"
              >
                <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-line/50 px-2.5">
                  <span className="truncate font-label text-[10.5px] font-bold caps-8 text-accent-soft">
                    {rightTitle}
                  </span>
                  <div className="flex items-center gap-1">
                    {rightHeaderExtra}
                    <button
                      type="button"
                      title={`Collapse ${rightTitle}`}
                      onClick={() => setRightOpen(false)}
                      className="flex h-6 w-6 items-center justify-center text-dim hover:text-ink cursor-pointer"
                    >
                      <PanelRightClose className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">{rightPanel}</div>
              </aside>
            </>
          ) : (
            <button
              type="button"
              title={`Expand ${rightTitle}`}
              onClick={() => setRightOpen(true)}
              className="flex h-full w-7 shrink-0 flex-col items-center border-l border-line/60 tone-sidebar-95 pt-2.5 text-dim hover:text-accent cursor-pointer"
            >
              <PanelRightOpen className="h-3.5 w-3.5" />
            </button>
          ))}
      </div>
    </CanvasStoreContext.Provider>
  )
}
