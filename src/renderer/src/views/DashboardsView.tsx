import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Layers, LayoutGrid, MessageSquare, Plus, Settings2, Trash2 } from 'lucide-react'
import type { AssetMeta, Dashboard } from '@shared/types'
import { SUGGESTED_ICONS } from '@shared/widgets'
import { Button, EmptyState, Field, Input, Modal, Select, ShellTabs, ViewHeader, DoneEditing, useAutosavedState } from '../components/ui'
import { BoardTabletop } from '../components/dashboards/BoardTabletop'
import { DashboardIcon } from '../components/dashboards/DashboardIcon'
import { AddPicker, fileThings, placeOnBoard } from '../components/dashboards/AddPicker'
import { takeBoardIntoChat, useBoardLayoutMode, useBoardSurfaces, useSurfaceSwitcher } from '../components/chat/tabletopStore'
import { useDashboards } from '../store/dashboards'
import { engine } from '../lib/ipc'
import { errorText } from '../lib/format'
import { toast } from '../store/toasts'
import { cn } from '../lib/cn'
import { LockedState, useLocked } from '../components/vault/Vault'
import { importPaths } from '../lib/importFiles'
import { failed } from '../lib/notify'
import { filePath } from '../lib/transport'
import { noteFailure } from '../store/problems'
import { useKeybindLabel } from '../store/keybinds'

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTED_ICONS.map((name) => (
          <button
            key={name}
            type="button"
            title={name}
            onClick={() => onChange(name)}
            className={cn(
              'flex h-8 w-8 items-center justify-center border transition-colors',
              value === name ? 'border-accent bg-accent/15 text-accent' : 'border-line/60 text-dim hover:border-accent hover:text-ink'
            )}
          >
            <DashboardIcon name={name} className="h-4 w-4" />
          </button>
        ))}
      </div>
      <Input value={value} onChange={(e) => onChange(e.target.value.trim().toLowerCase())} placeholder="Any Lucide icon name, e.g. dumbbell" className="h-8 font-ui text-[12px]" />
    </div>
  )
}

function DashboardSettings({ dashboard, list, onClose }: { dashboard: Dashboard | null; list: Dashboard[]; onClose: () => void }) {
  const setActive = useDashboards((s) => s.setActive)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const editor = useAutosavedState({ name: dashboard?.name ?? '', icon: dashboard?.icon ?? 'layout-dashboard', onToolbar: dashboard?.onToolbar ?? true }, (v) => engine('dashboards.update', { id: dashboard!.id, ...v }), { when: (v) => Boolean(dashboard && v.name.trim()) })
  const { name, icon, onToolbar } = editor.value
  const change = (patch: Partial<typeof editor.value>) => editor.set((v) => ({ ...v, ...patch }))
  const done = () => void editor.flush().then(onClose)

  const save = async () => {
    setError(null)
    try {
      setActive((await engine('dashboards.create', { name, icon, onToolbar })).id)
      onClose()
    } catch (err) {
      setError(errorText(err))
    }
  }

  const move = async (delta: number) => {
    if (!dashboard) return
    const ids = list.map((d) => d.id)
    const i = ids.indexOf(dashboard.id)
    const j = i + delta
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    await engine('dashboards.reorder', { ids }).catch(failed('Could not reorder'))
  }

  const remove = async () => {
    if (!dashboard) return
    await engine('dashboards.delete', { id: dashboard.id }).catch(failed('Delete failed'))
    onClose()
  }

  return (
    <Modal
      open
      title={dashboard ? `Dashboard · ${dashboard.name}` : 'New dashboard'}
      onClose={dashboard ? done : onClose}
      footer={
        <>
          {dashboard && (
            <Button variant="danger" icon={<Trash2 />} className="mr-auto" onClick={() => (confirm ? void remove() : setConfirm(true))}>
              {confirm ? 'Really delete' : 'Delete'}
            </Button>
          )}
          {dashboard ? (
            <DoneEditing saver={editor} onDone={onClose} size="md" />
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void save()}>
                Create
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Name" error={error}>
          <Input value={name} onChange={(e) => change({ name: e.target.value })} autoFocus={!dashboard} placeholder="Fitness" />
        </Field>
        <Field label="Icon">
          <IconPicker value={icon} onChange={(v) => change({ icon: v })} />
        </Field>
        {dashboard && list.length > 1 && (
          <Field label="Order">
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon={<ArrowLeft />} onClick={() => void move(-1)}>
                Earlier
              </Button>
              <Button size="sm" variant="secondary" icon={<ArrowRight />} onClick={() => void move(1)}>
                Later
              </Button>
            </div>
          </Field>
        )}
        {confirm && <div className="text-[12.5px] text-alert">Deleting removes the dashboard and its widgets. The pages and files stay.</div>}
      </div>
    </Modal>
  )
}

export function DashboardsView() {
  const locked = useLocked()
  if (locked) return <div className="h-full p-3"><LockedState what="Boards" /></div>
  return <DashboardsViewBody />
}

function DashboardsViewBody() {
  useEffect(() => {
    void useDashboards.getState().refresh().catch(noteFailure('dashboards', 'Could not list the dashboards'))
  }, [])
  const list = useDashboards((s) => s.list)
  const activeId = useDashboards((s) => s.activeId)
  const setActive = useDashboards((s) => s.setActive)
  const [settings, setSettings] = useState<'new' | 'edit' | null>(null)
  const [adding, setAdding] = useState(false)
  const active = list.find((d) => d.id === activeId) ?? list[0] ?? null
  const [layoutMode, setLayoutMode] = useBoardLayoutMode(active?.id ?? null, 'grid')
  const { state: surfaces, activeSlot, setActiveSurface } = useBoardSurfaces(active?.id ?? null)
  const toggleSwitcher = useSurfaceSwitcher((s) => s.toggle)
  const switcherKey = useKeybindLabel('tabletop.surfaceSwitcher')

  useEffect(() => {
    if (!active) return
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.closest('input, textarea, [contenteditable="true"]') || document.querySelector('[role="dialog"]'))) return
      const files = Array.from(e.clipboardData?.files ?? [])
      if (!files.length) return
      e.preventDefault()
      void (async () => {
        try {
          const added: AssetMeta[] = []
          for (const file of files) {
            const path = filePath(file)
            if (path) added.push(...(await importPaths([path])))
            else {
              const bytes = new Uint8Array(await file.arrayBuffer())
              let binary = ''
              for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
              const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin'
              added.push(await engine('data.assets.importBytes', { name: file.name || `pasted-${Date.now()}.${ext}`, base64: btoa(binary) }))
            }
          }
          await placeOnBoard(active.id, fileThings(added))
        } catch (err) {
          toast.error('Could not paste', errorText(err))
        }
      })()
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [active?.id])

  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <ViewHeader
        title="Dashboards"
        subtitle="Boards you put anything on: pages, pictures, music, video, PDFs. Drop or paste files straight onto a board."
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setSettings('new')}>
            New dashboard
          </Button>
        }
      />
      {list.length > 0 && (
        <ShellTabs
          className="shrink-0"
          value={active?.id ?? ''}
          options={list.map((d) => ({ value: d.id, label: d.name, icon: <DashboardIcon name={d.icon} />, count: d.widgets.length }))}
          onChange={setActive}
        >
          {active && (
            <>
              <div className="flex items-center border border-line/60 bg-card p-0.5">
                <button
                  type="button"
                  onClick={() => setLayoutMode('grid')}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 font-label text-[10px] caps-5 transition-colors',
                    layoutMode === 'grid' ? 'bg-accent/15 text-accent' : 'text-dim hover:text-ink'
                  )}
                  title="12-column resizable widget grid"
                >
                  <LayoutGrid className="h-3 w-3" />
                  Grid
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('tabletop')}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 font-label text-[10px] caps-5 transition-colors',
                    layoutMode === 'tabletop' ? 'bg-accent/15 text-accent' : 'text-dim hover:text-ink'
                  )}
                  title="Freeform tabletop tokens that unfold in-place"
                >
                  <Layers className="h-3 w-3" />
                  Tabletop
                </button>
              </div>
              <div className="flex items-center gap-1">
                <Select
                  value={activeSlot.id}
                  options={surfaces.slots.map((s) => ({
                    value: s.id,
                    label: `${s.index}: ${s.label}`
                  }))}
                  onChange={setActiveSurface}
                  className="h-7 w-36 font-ui text-[11px]"
                />
                <Button size="sm" variant="ghost" icon={<Layers />} onClick={toggleSwitcher} title={`SurfaceTop Overview (${switcherKey})`}>
                  Surfaces
                </Button>
              </div>
              <Button size="sm" variant="secondary" icon={<MessageSquare />} onClick={() => void takeBoardIntoChat(active.id)}>
                Take into chat
              </Button>
              <Button size="sm" variant="secondary" icon={<Plus />} onClick={() => setAdding(true)}>
                Add
              </Button>
              <Button size="sm" variant="ghost" icon={<Settings2 />} onClick={() => setSettings('edit')}>
                Settings
              </Button>
            </>
          )}
        </ShellTabs>
      )}
      <div className="min-h-0 flex-1 overflow-hidden">
        {!active ? (
          <EmptyState title="No dashboards">Create one here, or give an agent the Dashboards tools and ask it to build one.</EmptyState>
        ) : (
          <div className="relative h-full min-h-[520px] border border-line/40 bg-surface">
            <BoardTabletop key={active.id} dashboard={active} layoutMode={layoutMode} />
            {active.widgets.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="pointer-events-auto">
                  <EmptyState title="Empty board" action={<Button icon={<Plus />} onClick={() => setAdding(true)}>Add</Button>}>
                    Add anything, drop or paste files here, or ask an agent to.
                  </EmptyState>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {settings && <DashboardSettings dashboard={settings === 'edit' ? active : null} list={list} onClose={() => setSettings(null)} />}
      {adding && active && <AddPicker dashboard={active} onClose={() => setAdding(false)} />}
    </div>
  )
}
