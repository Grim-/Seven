import { IN_APP } from '../../lib/mode'
import { useMemo, useState } from 'react'
import { fileThings, placeOnBoard } from './AddPicker'
import { ViewSwitcher } from '../data/CollectionView'
import type { CollectionViewKind } from '@shared/types'
import ReactGridLayout, { useContainerWidth, type Layout } from 'react-grid-layout'
import { Database, Eye, Maximize2, Pencil, Settings2, X } from 'lucide-react'
import type { Dashboard, Widget } from '@shared/types'
import { GRID_COLS, NAMED_SIZES, VIEW_LABELS } from '@shared/widgets'
import { openMenu, DropOverlay, WidgetFrame } from '../ui'
import { useFileDrop } from '../../lib/useFileDrop'

import { WidgetBody } from './WidgetBody'
import { WidgetEditor } from './WidgetEditor'
import { engine } from '../../lib/ipc'
import { openSevenLink } from '../../lib/links'
import { widgetUi } from '../../registries/widgets'
import { errorText } from '../../lib/format'
import { toast } from '../../store/toasts'
import { cn } from '../../lib/cn'
import { importPaths } from '../../lib/importFiles'
import { failed } from '../../lib/notify'

function WidgetChrome({
  dashboard,
  widget,
  editable,
  editing,
  compact,
  onSettings
}: {
  dashboard: Dashboard
  widget: Widget
  editable: boolean
  editing: boolean
  compact: boolean
  onSettings: () => void
}) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const remove = () =>
    void engine('widgets.remove', { dashboardId: dashboard.id, widgetId: widget.id }).catch(failed('Could not remove'))
  const update = (patch: { title?: string; view?: string }) =>
    void engine('widgets.update', { dashboardId: dashboard.id, widgetId: widget.id, ...patch }).catch(failed('Could not change'))
  const saveTitle = () => {
    if (renaming !== null && renaming.trim() && renaming.trim() !== widget.title) update({ title: renaming.trim() })
    setRenaming(null)
  }
  const resize = (size: { w: number; h: number }) =>
    void engine('widgets.layout', {
      dashboardId: dashboard.id,
      layouts: dashboard.widgets.map((w) => ({ id: w.id, ...w.layout, ...(w.id === widget.id ? { w: Math.min(GRID_COLS, size.w), h: size.h } : {}) }))
    }).catch(failed('Could not resize'))
  const ui = widgetUi(widget.source)
  const entry = ui.entry?.(widget.source) ?? null
  const openInData = () => entry && openSevenLink(`seven:${entry}`)
  const switchViews = ui.switchViews?.(widget) ?? []
  const menu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea, iframe')) return
    openMenu(e, widget.title, [
      { label: 'Settings', icon: <Settings2 />, onSelect: onSettings },
      ...(editable ? [{ label: 'Rename', icon: <Pencil />, onSelect: () => setRenaming(widget.title) }] : []),
      ...(switchViews.length
        ? [{ label: 'View', icon: <Eye />, children: switchViews.map((v) => ({ label: `${VIEW_LABELS[v] ?? v}${widget.view === v ? '  ✓' : ''}`, onSelect: () => update({ view: v }) })) }]
        : []),
      ...(editable ? [{ label: 'Size', icon: <Maximize2 />, children: Object.entries(NAMED_SIZES).map(([name, size]) => ({ label: `${name[0].toUpperCase()}${name.slice(1)} (${size.w}×${size.h})`, onSelect: () => resize(size) })) }] : []),
      ...(IN_APP && entry ? [{ label: 'Open in Data', icon: <Database />, onSelect: openInData }] : []),
      ...(editable ? [{ label: '', separator: true }, { label: 'Remove from board', icon: <X />, danger: true, onSelect: remove }] : [])
    ])
  }
  return (
    <WidgetFrame
      editing={editing}
      compact={compact}
      flush={ui.flush === true}
      onContextMenu={menu}
      title={
        renaming !== null ? (
          <input
            autoFocus
            value={renaming}
            onChange={(e) => setRenaming(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTitle()
              if (e.key === 'Escape') setRenaming(null)
            }}
            className="widget-actions min-w-0 flex-1 border border-accent/60 bg-black px-1 text-[12px] normal-case tracking-normal text-white outline-none"
          />
        ) : (
          <span onDoubleClick={() => editable && setRenaming(widget.title)} title={editable ? 'Double-click to rename' : undefined} className="min-w-0 flex-1 truncate">
            {widget.title}
          </span>
        )
      }
      tools={
        <>
          {switchViews.length > 0 && !compact && <ViewSwitcher compact value={widget.view as CollectionViewKind} onChange={(view) => update({ view })} />}
          <button title="Settings" onClick={onSettings} className="flex h-6 w-6 items-center justify-center text-dim hover:text-accent">
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          {editing && (
            <button title="Remove from board" onClick={remove} className="flex h-6 w-6 items-center justify-center text-dim hover:text-alert">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      }
    >
      <WidgetBody dashboard={dashboard} widget={widget} />
    </WidgetFrame>
  )
}

export function DashboardGrid({ dashboard, editable = true, editing = false, compact = false }: { dashboard: Dashboard; editable?: boolean; editing?: boolean; compact?: boolean }) {
  const { width, containerRef, mounted } = useContainerWidth()
  const [configuring, setConfiguring] = useState<Widget | null>(null)
  const layout = useMemo<Layout>(() => dashboard.widgets.map((w) => ({ i: w.id, ...w.layout, minW: 2, minH: 2 })), [dashboard.widgets])

  const persist = (next: Layout) => {
    const changed = next.some((l) => {
      const w = dashboard.widgets.find((x) => x.id === l.i)
      return w && (w.layout.x !== l.x || w.layout.y !== l.y || w.layout.w !== l.w || w.layout.h !== l.h)
    })
    if (!changed) return
    void engine('widgets.layout', { dashboardId: dashboard.id, layouts: next.map((l) => ({ id: l.i, x: l.x, y: l.y, w: l.w, h: l.h })) }).catch((err) =>
      toast.error('Could not save layout', errorText(err))
    )
  }

  const rowHeight = compact ? 30 : 40
  const margin = compact ? 8 : 12
  const drop = async (paths: string[], e: React.DragEvent) => {
    const box = e.currentTarget.getBoundingClientRect()
    const at = {
      x: Math.max(0, Math.min(GRID_COLS - 2, Math.floor(((e.clientX - box.left) / Math.max(1, box.width)) * GRID_COLS))),
      y: Math.max(0, Math.floor((e.clientY - box.top) / (rowHeight + margin)))
    }
    try {
      const added = await importPaths(paths)
      await placeOnBoard(dashboard.id, fileThings(added), at)
    } catch (err) {
      toast.error('Could not add files', errorText(err))
    }
  }
  const fileDrop = useFileDrop((paths, e) => void drop(paths, e), editable)

  return (
    <div
      ref={containerRef}
      className={cn('relative min-h-full w-full', editing && 'shell-dots')}
      {...fileDrop.props}
    >
      <DropOverlay show={fileDrop.over} label="Drop to put on the board" className="inset-0 min-h-40 bg-black/70" />
      {mounted && width > 0 && (
        <ReactGridLayout
          width={width}
          layout={layout}
          gridConfig={{ cols: GRID_COLS, rowHeight, margin: [margin, margin], containerPadding: [0, 0] }}
          dragConfig={{ enabled: editing, handle: '.widget-handle', cancel: '.widget-actions' }}
          resizeConfig={{ enabled: editing }}
          onDragStop={(next) => persist(next)}
          onResizeStop={(next) => persist(next)}
        >
          {dashboard.widgets.map((w) => (
            <div key={w.id}>
              <WidgetChrome dashboard={dashboard} widget={w} editable={editable} editing={editing} compact={compact} onSettings={() => setConfiguring(w)} />
            </div>
          ))}
        </ReactGridLayout>
      )}
      {configuring && <WidgetEditor dashboard={dashboard} widget={configuring} onClose={() => setConfiguring(null)} />}
    </div>
  )
}
