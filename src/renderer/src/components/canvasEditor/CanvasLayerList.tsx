import { useState, type ReactNode } from 'react'
import { Eye, EyeOff, GripVertical, Lock, Unlock } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useCanvasEditor, useCanvasEditorStore } from './store'
import type { CanvasLayerState } from './types'

export type CanvasLayerListProps = {
  /** Optional custom row badge (e.g. item count or gating indicator). */
  renderBadge?: (layer: CanvasLayerState) => ReactNode
  /** Optional right-click menu handler for a layer row. */
  onLayerContextMenu?: (e: React.MouseEvent, layer: CanvasLayerState) => void
  /** Allow drag-to-reorder z-order. */
  reorderable?: boolean
  /** Show per-layer opacity slider on hover/selected. */
  showOpacity?: boolean
  className?: string
}

/**
 * Shared Layers Stack panel: visibility eye toggle, lock toggle (feeds directly into
 * `CanvasPicker` so locked layers cannot be picked or dragged), z-order drag reorder,
 * and optional opacity control.
 */
export function CanvasLayerList({
  renderBadge,
  onLayerContextMenu,
  reorderable = true,
  showOpacity = false,
  className
}: CanvasLayerListProps) {
  const store = useCanvasEditorStore()
  const layers = useCanvasEditor((s) => s.layers)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  // Display highest z-order on top (matches Photoshop / Godot / Blender)
  const ordered = [...layers].sort((a, b) => b.order - a.order)

  const handleDropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null)
      setOverId(null)
      return
    }
    const ids = ordered.map((l) => l.id)
    const fromIdx = ids.indexOf(dragId)
    const toIdx = ids.indexOf(targetId)
    if (fromIdx !== -1 && toIdx !== -1) {
      ids.splice(fromIdx, 1)
      ids.splice(toIdx, 0, dragId)
      store.getState().reorderLayers(ids)
    }
    setDragId(null)
    setOverId(null)
  }

  return (
    <div className={cn('flex flex-col divide-y divide-line/25 font-ui', className)}>
      {ordered.map((layer) => {
        const isOver = overId === layer.id && dragId !== layer.id
        return (
          <div
            key={layer.id}
            draggable={reorderable}
            onDragStart={() => setDragId(layer.id)}
            onDragOver={(e) => {
              if (!reorderable) return
              e.preventDefault()
              setOverId(layer.id)
            }}
            onDragLeave={() => {
              if (overId === layer.id) setOverId(null)
            }}
            onDrop={(e) => {
              e.preventDefault()
              handleDropOn(layer.id)
            }}
            onDragEnd={() => {
              setDragId(null)
              setOverId(null)
            }}
            onContextMenu={onLayerContextMenu ? (e) => onLayerContextMenu(e, layer) : undefined}
            className={cn(
              'flex flex-col gap-1 px-2 py-1.5 text-[12px] transition-colors',
              !layer.visible && 'opacity-50',
              isOver && 'border-t-2 border-t-accent bg-accent/10',
              'hover:tone-card-40'
            )}
          >
            <div className="flex items-center gap-1.5">
              {reorderable && (
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-faint cursor-grab" />
              )}
              {layer.color && (
                <span
                  style={{ backgroundColor: layer.color }}
                  className="h-2.5 w-2.5 shrink-0 border border-line/60"
                />
              )}
              <span className="min-w-0 flex-1 truncate font-medium text-ink">{layer.label}</span>
              {renderBadge?.(layer)}
              <button
                type="button"
                title={layer.locked ? 'Unlock layer' : 'Lock layer (ignore clicks & drags)'}
                onClick={(e) => {
                  e.stopPropagation()
                  store.getState().toggleLayerLocked(layer.id)
                }}
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center transition-colors cursor-pointer',
                  layer.locked ? 'text-warn' : 'text-faint hover:text-ink'
                )}
              >
                {layer.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              </button>
              <button
                type="button"
                title={layer.visible ? 'Hide layer' : 'Show layer'}
                onClick={(e) => {
                  e.stopPropagation()
                  store.getState().toggleLayerVisible(layer.id)
                }}
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center transition-colors cursor-pointer',
                  layer.visible ? 'text-dim hover:text-ink' : 'text-faint hover:text-ink'
                )}
              >
                {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
            </div>

            {showOpacity && (
              <div className="flex items-center gap-2 pl-5">
                <span className="font-label text-[9.5px] caps-5 text-faint">Opacity</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(layer.opacity * 100)}
                  onChange={(e) =>
                    store.getState().setLayerOpacity(layer.id, Number(e.target.value) / 100)
                  }
                  className="h-1 flex-1 accent-[var(--color-accent)] cursor-pointer"
                />
                <span className="w-7 text-right font-data text-[10px] text-dim">
                  {Math.round(layer.opacity * 100)}%
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
