import { createElement } from 'react'
import { Database, ExternalLink, FolderOpen, Layers, LayoutDashboard, Maximize2, PanelRight } from 'lucide-react'
import type { Dashboard, Widget } from '@shared/types'
import { showName } from '@shared/ids'
import { engine } from '../../lib/ipc'
import { IN_APP } from '../../lib/mode'
import { errorText } from '../../lib/format'
import { toast } from '../../store/toasts'
import { useApp } from '../../store/app'
import { useDashboards } from '../../store/dashboards'
import { useWindows } from '../../store/windows'
import { usePanel, useSide } from '../../store/panel'
import { focusedConversation } from '../../lib/conversation'
import { isFileFavouriteKind } from '../../lib/favourites'
import { showInData } from '../../lib/library'
import { openSidePanelTab } from '../../lib/listPrefs'
import { useStage } from '../../registries/presentations'
import type { MenuItem } from '../ui'

export interface WidgetPanelRef {
  dashboardId: string
  widgetId: string
  title?: string
  dashboardName?: string
}

function targetConversation(): { convKey: string; sessionId: string | null } {
  const conv = focusedConversation()
  const convKey = conv?.key ?? useWindows.getState().home ?? 'chat'
  return { convKey, sessionId: conv?.sessionId ?? null }
}

function notifyOutputsIfAway(): void {
  if (useApp.getState().view === 'chat') return
  toast.success('In the side panel', 'Added to the chat’s Outputs tab.', {
    label: 'Open chat',
    onSelect: () => useApp.getState().setView('chat')
  })
}

export async function showInPanel(
  entry: string,
  part: string | null = null,
  fallbackWidget?: WidgetPanelRef
): Promise<void> {
  const { convKey, sessionId } = targetConversation()
  try {
    if (sessionId) {
      try {
        await engine('panel.showEntry', { sessionId, entry, part })
      } catch (err) {
        if (!fallbackWidget) throw err
        await engine('panel.showWidget', {
          sessionId,
          dashboardId: fallbackWidget.dashboardId,
          widgetId: fallbackWidget.widgetId
        })
      }
    } else {
      const slash = entry.indexOf('/')
      const kind = slash > 0 ? entry.slice(0, slash) : entry
      const id = slash > 0 ? entry.slice(slash + 1) : ''
      usePanel.getState().showDraft(convKey, {
        module: 'data',
        key: entry,
        tab: 'outputs',
        view:
          fallbackWidget && (!kind || !id)
            ? {
                kind: 'widget',
                title: `${fallbackWidget.dashboardName ?? 'Board'} · ${fallbackWidget.title ?? entry}`,
                data: { dashboardId: fallbackWidget.dashboardId, widgetId: fallbackWidget.widgetId }
              }
            : {
                kind: 'entry',
                title: showName(id || entry),
                data: { kind, id, part: part ?? 'card' }
              }
      })
    }
    openSidePanelTab('outputs')
    notifyOutputsIfAway()
  } catch (err) {
    toast.error('Could not show it', errorText(err))
  }
}

export async function showWidgetInPanel(dashboard: Pick<Dashboard, 'id' | 'name'>, widget: Pick<Widget, 'id' | 'title'>): Promise<void> {
  const { convKey, sessionId } = targetConversation()
  try {
    if (sessionId) {
      await engine('panel.showWidget', { sessionId, dashboardId: dashboard.id, widgetId: widget.id })
    } else {
      usePanel.getState().showDraft(convKey, {
        module: 'dashboards',
        key: `widget:${widget.id}`,
        tab: 'outputs',
        view: {
          kind: 'widget',
          title: `${dashboard.name} · ${widget.title}`,
          data: { dashboardId: dashboard.id, widgetId: widget.id }
        }
      })
    }
    openSidePanelTab('outputs')
    notifyOutputsIfAway()
  } catch (err) {
    toast.error('Could not show it', errorText(err))
  }
}

export function showEntryInSideBrowser(kind: string, id: string): void {
  useSide.getState().setFiles({ kind, id })
  openSidePanelTab(isFileFavouriteKind(kind) ? 'files' : 'data')
  if (useApp.getState().view !== 'chat') useApp.getState().setView('chat')
}

export function showEntryInMainView(kind: string, id: string): void {
  showInData({ kind, id })
}

export function showDashboardInMainView(dashboardId: string): void {
  useDashboards.getState().setActive(dashboardId)
  useApp.getState().setView('dashboards')
}

export function showOnStage(opts: {
  entryKind?: string | null
  entryId?: string | null
  entryPart?: string | null
  dashboardId?: string
  widgetId?: string
}): void {
  if (opts.entryKind && opts.entryId) {
    useStage.getState().play({
      type: 'entry',
      fields: { kind: opts.entryKind, id: opts.entryId, part: opts.entryPart ?? 'card' },
      where: 'stage',
      key: null
    })
    return
  }
  if (opts.dashboardId && opts.widgetId) {
    useStage.getState().play({
      type: 'widget',
      fields: { dashboardId: opts.dashboardId, widgetId: opts.widgetId },
      where: 'stage',
      key: null
    })
  }
}

export interface SlateSurfaceOptions {
  entryKind?: string | null
  entryId?: string | null
  entryPart?: string | null
  dashboard?: Pick<Dashboard, 'id' | 'name'> | null
  widget?: Pick<Widget, 'id' | 'title'> | null
  onPin?: () => void
  onToggleMaximize?: () => void
  maximized?: boolean
}

/** Builds "Open in…" menu items for every surface view available to a slate. */
export function slateSurfaceMenuItems(opts: SlateSurfaceOptions): MenuItem[] {
  const hasEntry = Boolean(opts.entryKind && opts.entryId)
  const fallback =
    opts.dashboard && opts.widget
      ? {
          dashboardId: opts.dashboard.id,
          widgetId: opts.widget.id,
          title: opts.widget.title,
          dashboardName: opts.dashboard.name
        }
      : undefined

  const showInOutputs = () => {
    if (opts.entryKind && opts.entryId) {
      return void showInPanel(`${opts.entryKind}/${opts.entryId}`, opts.entryPart ?? null, fallback)
    }
    if (opts.dashboard && opts.widget) {
      return void showWidgetInPanel(opts.dashboard, opts.widget)
    }
  }

  const items: MenuItem[] = []
  if (hasEntry || fallback) {
    items.push({
      label: 'Sidebar · Outputs',
      icon: createElement(PanelRight),
      onSelect: showInOutputs
    })
  }
  if (opts.entryKind && opts.entryId) {
    const kind = opts.entryKind
    const id = opts.entryId
    const isFile = isFileFavouriteKind(kind)
    items.push({
      label: isFile ? 'Sidebar · Files' : 'Sidebar · Data',
      icon: createElement(isFile ? FolderOpen : Database),
      onSelect: () => showEntryInSideBrowser(kind, id)
    })
  }
  if (hasEntry || (opts.dashboard && opts.widget)) {
    items.push({
      label: 'Stage spotlight',
      icon: createElement(Maximize2),
      onSelect: () =>
        showOnStage({
          entryKind: opts.entryKind,
          entryId: opts.entryId,
          entryPart: opts.entryPart,
          dashboardId: opts.dashboard?.id,
          widgetId: opts.widget?.id
        })
    })
  }
  if (IN_APP && opts.entryKind && opts.entryId) {
    const kind = opts.entryKind
    const id = opts.entryId
    const isFile = isFileFavouriteKind(kind)
    items.push({
      label: isFile ? 'Files view' : 'Data view',
      icon: createElement(ExternalLink),
      onSelect: () => showEntryInMainView(kind, id)
    })
  }
  if (IN_APP && opts.dashboard && useApp.getState().view !== 'dashboards') {
    const dashId = opts.dashboard.id
    items.push({
      label: 'Dashboards view',
      icon: createElement(LayoutDashboard),
      onSelect: () => showDashboardInMainView(dashId)
    })
  }
  if (!opts.dashboard && hasEntry && opts.onPin) {
    items.push({
      label: 'Tabletop board',
      icon: createElement(Layers),
      onSelect: opts.onPin
    })
  }
  if (opts.onToggleMaximize && !opts.maximized) {
    items.push({
      label: 'Maximized modal',
      icon: createElement(Maximize2),
      onSelect: opts.onToggleMaximize
    })
  }
  return items
}
