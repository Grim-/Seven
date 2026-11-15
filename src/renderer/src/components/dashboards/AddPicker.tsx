import { useMemo } from 'react'
import { Import, LayoutDashboard, Plus } from 'lucide-react'
import { widgetUiOf } from '../../registries/widgets'
import { useWidgetInfo } from '../../store/widgetInfo'
import { useTools } from '../../store/tools'
import type { AssetMeta, Dashboard, Widget } from '@shared/types'
import { showName } from '@shared/ids'
import { Button, KindShell, Modal, type ShellAdd, type ShellItem } from '../ui'
import { KindExplorer } from '../library/KindExplorer'
import { engine } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { toast } from '../../store/toasts'
import { chooseFiles } from '../../lib/importFiles'
import { useBusy } from '../../lib/useBusy'
import {
  getBoardSurfaces,
  updateWidgetTokenPose,
  useBoardLayoutMode,
  usePendingBoardPlacement,
  useTabletopMode,
  type WidgetTokenPose
} from '../chat/tabletopStore'
import { useApp } from '../../store/app'
import { useDashboards } from '../../store/dashboards'

export function fileThings(files: AssetMeta[]): string[] {
  return files.map((f) => `file/${f.id}`)
}

function applyNewWidgetPoses(
  dashboardId: string,
  updated: Dashboard,
  addedWidgets: Widget[],
  at: { x: number; y: number } | null = null,
  posePatch?: Partial<WidgetTokenPose>,
  canvas?: { w: number; h: number } | null
): void {
  const activeSurfaceId = getBoardSurfaces(dashboardId).activeId
  addedWidgets.forEach((w, idx) => {
    const widgetIndex = Math.max(0, updated.widgets.indexOf(w))
    updateWidgetTokenPose(
      dashboardId,
      w.id,
      {
        surfaceId: activeSurfaceId,
        ...(at ? { x: at.x + idx * 28, y: at.y + idx * 28, expanded: true } : {}),
        ...posePatch
      },
      widgetIndex,
      w,
      canvas
    )
  })
}

export async function placeOnBoard(
  dashboardId: string,
  things: string[],
  at: { x: number; y: number } | null = null,
  posePatch?: Partial<WidgetTokenPose>,
  canvas?: { w: number; h: number } | null
): Promise<void> {
  if (!things.length) return
  const beforeIds = new Set(
    (useDashboards.getState().list.find((d) => d.id === dashboardId)?.widgets ?? []).map((w) => w.id)
  )
  const updated = await engine('widgets.place', { dashboardId, things, at: null })
  useDashboards.getState().onChanged(updated.id, updated)
  const added = updated.widgets.filter((w) => !beforeIds.has(w.id))
  const targets = added.length > 0 ? added : updated.widgets.slice(-1)
  applyNewWidgetPoses(dashboardId, updated, targets, at, posePatch, canvas)
}

function GlancesAndWidgetsTab({
  dashboard,
  clickToPlace,
  onAdded
}: {
  dashboard: Dashboard
  clickToPlace: boolean
  onAdded: () => void
}) {
  const modules = useTools((s) => s.list)
  const providers = useWidgetInfo((s) => s.providers)
  const setPending = usePendingBoardPlacement((s) => s.setPending)
  const [, run] = useBusy()

  const items: ShellItem[] = useMemo(() => {
    const out: ShellItem[] = []
    for (const p of providers) {
      const ui = widgetUiOf(p.kind)?.choices
      if (!ui) continue
      const list = (p.choices ?? []).filter((c) => !c.module || modules.some((m) => m.id === c.module && m.state === 'on'))
      for (const c of list) {
        out.push({
          key: `${p.kind}:${c.id}`,
          title: c.label,
          subtitle: ui.heading,
          tag: ui.meta.toUpperCase(),
          icon: ui.icon
        })
      }
    }
    return out
  }, [providers, modules])

  const adds: ShellAdd[] = providers
    .filter((p) => p.create)
    .map((p) => ({
      label: p.create as string,
      icon: widgetUiOf(p.kind)?.createIcon ?? <Plus />,
      onClick: () => {
        const label = p.create as string
        const commit = async (pt?: { x: number; y: number }, canvas?: { w: number; h: number } | null) => {
          const updated = await engine('widgets.create', { dashboardId: dashboard.id, kind: p.kind })
          useDashboards.getState().onChanged(updated.id, updated)
          const newest = updated.widgets.at(-1)
          if (newest) applyNewWidgetPoses(dashboard.id, updated, [newest], pt ?? null, undefined, canvas)
          toast.success(`Added to ${dashboard.name}`, label)
        }
        if (clickToPlace) {
          setPending({ dashboardId: dashboard.id, label, commit: (pt, canvas) => commit(pt, canvas) })
          onAdded()
          return
        }
        void run(() => commit(), 'Could not add widget')
      }
    }))

  return (
    <KindShell
      id="pick-board-widgets"
      layouts={['cards', 'tiles', 'list']}
      items={items}
      adds={adds}
      onOpen={(item) => {
        const colon = item.key.indexOf(':')
        if (colon < 0) return
        const kind = item.key.slice(0, colon)
        const id = item.key.slice(colon + 1)
        const source = widgetUiOf(kind)?.choices?.source(id)
        if (!source) return
        const commit = async (pt?: { x: number; y: number }, canvas?: { w: number; h: number } | null) => {
          const updated = await engine('widgets.add', { dashboardId: dashboard.id, title: null, source, view: null, options: null })
          useDashboards.getState().onChanged(updated.id, updated)
          const newest = updated.widgets.at(-1)
          if (newest) applyNewWidgetPoses(dashboard.id, updated, [newest], pt ?? null, undefined, canvas)
          toast.success(`Added to ${dashboard.name}`, item.title)
        }
        if (clickToPlace) {
          setPending({ dashboardId: dashboard.id, label: item.title, commit: (pt, canvas) => commit(pt, canvas) })
          onAdded()
          return
        }
        void run(async () => {
          await commit()
          onAdded()
        }, 'Could not add widget')
      }}
      empty="No glances or tool widgets available."
    />
  )
}

export function AddPicker({ dashboard, onClose }: { dashboard: Dashboard; onClose: () => void }) {
  const [busy, run] = useBusy()
  const appView = useApp((s) => s.view)
  const [chatMode] = useTabletopMode()
  const [boardMode] = useBoardLayoutMode(dashboard.id, 'grid')
  const setPending = usePendingBoardPlacement((s) => s.setPending)
  const clickToPlace = appView === 'chat' ? chatMode.layoutMode === 'tabletop' : boardMode === 'tabletop'

  const pickEntry = (kind: string, id: string) => {
    const label = showName(id)
    if (clickToPlace) {
      setPending({
        dashboardId: dashboard.id,
        label,
        commit: async (pt, canvas) => {
          await placeOnBoard(dashboard.id, [`${kind}/${id}`], pt, undefined, canvas)
          toast.success(`Added to ${dashboard.name}`, label)
        }
      })
      onClose()
      return
    }
    void run(async () => {
      await placeOnBoard(dashboard.id, [`${kind}/${id}`])
      toast.success(`Added to ${dashboard.name}`, label)
    }, 'Could not add to board')
  }

  const importFiles = async () => {
    const added = await chooseFiles()
    if (!added.length) return
    const label = `${added.length} file${added.length === 1 ? '' : 's'}`
    if (clickToPlace) {
      setPending({
        dashboardId: dashboard.id,
        label,
        commit: async (pt, canvas) => {
          await placeOnBoard(dashboard.id, fileThings(added), pt, undefined, canvas)
          toast.success(`Added to ${dashboard.name}`, label)
        }
      })
      onClose()
      return
    }
    try {
      await placeOnBoard(dashboard.id, fileThings(added))
      toast.success(`Added to ${dashboard.name}`, label)
    } catch (err) {
      toast.error('Could not add files', errorText(err))
    }
  }

  return (
    <Modal
      open
      wide
      title={`Add to ${dashboard.name}`}
      onClose={onClose}
      bodyClassName="flex h-[72vh] min-h-0 flex-col p-3"
      footer={
        <>
          <Button variant="ghost" icon={<Import />} disabled={busy} onClick={() => void importFiles()}>
            Files from disk…
          </Button>
          <span className="flex-1 font-mono text-[11px] text-dim">
            {clickToPlace
              ? `Select any item, then click on ${dashboard.name} where you want to place it.`
              : `Click any card, tile, or row to place it on ${dashboard.name}, or drag items straight onto the board.`}
          </span>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <KindExplorer
        id="board.addExplorer"
        onPick={pickEntry}
        tabs={[
          {
            id: '__widgets',
            label: 'Glances & Widgets',
            icon: <LayoutDashboard className="h-3.5 w-3.5" />,
            node: <GlancesAndWidgetsTab dashboard={dashboard} clickToPlace={clickToPlace} onAdded={onClose} />
          }
        ]}
      />
    </Modal>
  )
}
