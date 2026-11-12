import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { create } from 'zustand'
import { ChevronDown, ChevronLeft, Database, Dumbbell, FolderOpen, Gauge, Inbox, Maximize2, Minimize2, Plus, Trash2, X } from 'lucide-react'
import type { PanelItem, SidePanelPrefs } from '@shared/types'
import { useApp } from '../../store/app'
import type { DataSelection } from '../../store/data'
import { DataBrowser } from '../../views/DataView'
import { LockedState, useLocked } from '../vault/Vault'
import { cn } from '../../lib/cn'
import { formatRelative } from '../../lib/format'
import { useAgents } from '../../store/agents'
import { useTools } from '../../store/tools'
import { agentGroups, useToolsets } from '../../store/toolsets'
import { unseenIn, usePanel } from '../../store/panel'
import { registerSideTab, sideTabs, type SideTabContext, type SideTabDef } from '../../registries/side'
import { ViewRenderer } from '../../registries/views'
import { EmptyState, Gutter, SidePane, openMenu } from '../ui'
import { ModulePageView } from '../present/template'
import { WorkoutPanel } from '../workout/Workout'
import { useData, usePage } from '../../store/data'
import { StatsTab } from './StatsTab'
import { KindIcon } from '../../lib/library'
import { presentOf, viewKinds } from '../../registries/kinds'
import { KindBrowser } from '../data/KindBrowser'
import './BrowserTab'
import { useAgentIdOf, useConversation } from '../../lib/conversation'
import { saveTrayKinds, useKindList } from '../../lib/kinds'
import { useDrawerPrefs } from '../../lib/listPrefs'

const MIN = 280
const MAX = 900
const DEFAULTS: SidePanelPrefs = { open: false, width: 380, tab: 'files' }
const EMPTY: PanelItem[] = []

interface SideState {
  files: DataSelection | null
  setFiles: (s: DataSelection | null) => void
}

export const useSide = create<SideState>((set) => ({
  files: null,
  setFiles: (files) => set({ files })
}))

function usePrefs(): [SidePanelPrefs, (patch: Partial<SidePanelPrefs>) => void] {
  return useDrawerPrefs('sidePanel', DEFAULTS)
}

function useActiveItems(): { sessionId: string | null; items: PanelItem[] } {
  const { sessionId } = useConversation()
  const items = usePanel((s) => (sessionId ? (s.items[sessionId] ?? EMPTY) : EMPTY))
  useEffect(() => {
    if (sessionId) void usePanel.getState().load(sessionId).catch(() => undefined)
  }, [sessionId])
  return { sessionId, items }
}

function FilesTab() {
  const locked = useLocked()
  const selected = useSide((s) => s.files)
  const select = useSide((s) => s.setFiles)
  if (locked) return <div className="p-2.5"><LockedState what="Pages and files" /></div>
  return <DataBrowser mode="panel" selected={selected} select={select} only={viewKinds('pages')} />
}

function DataTab() {
  const locked = useLocked()
  const selected = useSide((s) => s.files)
  const select = useSide((s) => s.setFiles)
  if (locked) return <div className="p-2.5"><LockedState what="Data" /></div>
  return <DataBrowser mode="panel" selected={selected} select={select} />
}

export function PanelItems({ tab, empty }: { tab: string; empty: string }) {
  const { sessionId, items } = useActiveItems()
  const shown = useMemo(() => items.filter((i) => i.tab === tab).reverse(), [items, tab])
  if (!sessionId || !shown.length)
    return (
      <div className="p-3">
        <EmptyState title="Nothing here yet">{empty}</EmptyState>
      </div>
    )
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center border-b border-line/40 px-2.5 py-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{shown.length} item{shown.length === 1 ? '' : 's'}</span>
        <button
          onClick={() => void usePanel.getState().clear(sessionId, tab)}
          className="ml-auto flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-dim hover:text-alert"
        >
          <Trash2 className="h-3 w-3" /> Clear
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
        {shown.map((item) => (
          <div key={item.id} className="flex flex-col border border-line/50 bg-black/40">
            <div className="flex items-center gap-2 border-b border-line/40 px-2.5 py-1">
              <span className="truncate text-[12px] text-white">{item.view.title ?? item.module}</span>
              <span className="ml-auto shrink-0 font-mono text-[10px] text-faint">{formatRelative(item.updatedAt)}</span>
              <button title="Remove" onClick={() => void usePanel.getState().remove(sessionId, item.id)} className="text-dim hover:text-alert">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="min-w-0 p-2">
              <ViewRenderer view={item.view} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

registerSideTab({
  id: 'workout',
  label: 'Workout',
  icon: <Dumbbell className="h-3.5 w-3.5" />,
  order: 30,
  visible: () => useTools.getState().list.some((m) => m.id === 'workout' && m.state === 'on'),
  render: () => <WorkoutPanel compact />
})
registerSideTab({ id: 'stats', label: 'Stats', icon: <Gauge className="h-3.5 w-3.5" />, order: 20, render: () => <StatsTab /> })
registerSideTab({ id: 'data', label: 'Data', icon: <Database className="h-3.5 w-3.5" />, order: 5, render: () => <DataTab /> })
registerSideTab({ id: 'files', label: 'Files', icon: <FolderOpen className="h-3.5 w-3.5" />, order: 0, render: () => <FilesTab /> })
registerSideTab({
  id: 'outputs',
  label: 'Outputs',
  icon: <Inbox className="h-3.5 w-3.5" />,
  order: 10,
  render: () => <PanelItems tab="outputs" empty="Things agents put in the side panel for this chat show here." />
})

function TypedPageTab({ type }: { type: string }) {
  const meta = useData((s) => s.pages.find((p) => p.type === type))
  const page = usePage(meta?.id ?? null)
  useEffect(() => {
    if (!meta) void useData.getState().refresh().catch(() => undefined)
  }, [meta])
  if (!page) return null
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-2">
      <ModulePageView pageId={page.id} version={page.version} />
    </div>
  )
}

function useTabs() {
  const { sessionId, items } = useActiveItems()
  const agentId = useAgentIdOf(useConversation())
  const agents = useAgents((s) => s.list)
  const modules = useTools((s) => s.list)
  const toolsetList = useToolsets((s) => s.list)
  const agentRec = agents.find((a) => a.id === agentId)
  const agentModules = agentRec ? agentGroups(agentRec, toolsetList, modules) : []
  const ctx: SideTabContext = { sessionId, agentModules, hasItems: (tab) => items.some((i) => i.tab === tab) }
  const tabs = sideTabs(
    modules,
    ctx,
    (id) => () => <PanelItems tab={id} empty="Nothing from this tool in this chat yet." />,
    (type) => () => <TypedPageTab type={type} />
  )
  return { tabs, ctx, sessionId, items }
}

export function SidePanelToggle({ className }: { className?: string }) {
  const [prefs, save] = usePrefs()
  const { sessionId, items } = useActiveItems()
  const seen = usePanel((s) => s.seen)
  const unseen = !prefs.open && sessionId ? unseenIn(items, seen, sessionId, null) : 0
  const open = prefs.open
  return (
    <button
      type="button"
      title={open ? 'Hide side panel' : 'Show side panel'}
      onClick={() => save({ open: !open })}
      className={cn(
        'bracket-right group relative w-3.5 shrink-0 self-stretch min-h-[48px] cursor-pointer select-none border-y border-l transition-all outline-none',
        open
          ? 'border-accent/80 bg-accent/15 text-accent shadow-[0_0_10px_color-mix(in_srgb,var(--color-accent)_25%,transparent)]'
          : 'border-line bg-black/60 text-dim hover:border-accent hover:bg-accent/10',
        className
      )}
    >
      <span
        className={cn(
          'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1.5px] h-5 transition-all',
          open ? 'bg-accent shadow-[0_0_8px_var(--color-accent)]' : 'bg-dim/70 group-hover:bg-accent'
        )}
      />
      {unseen > 0 && <span className="absolute -top-1 -left-1 h-2 w-2 bg-accent shadow-[0_0_6px_var(--color-accent)]" />}
    </button>
  )
}

const KIND_TAB = 'kind:'

function KindTab({ kind, label }: { kind: string; label: string }) {
  const locked = useLocked()
  const [sel, setSel] = useState<DataSelection>({ kind, id: 'all' })
  if (locked) return <div className="p-2.5"><LockedState what={label} /></div>
  const Screen = presentOf(sel.kind).Screen
  const id = sel.id === 'all' ? null : sel.id
  const select = (s: DataSelection | null) => setSel(s ?? { kind, id: 'all' })
  const home = sel.kind === kind && sel.id === 'all'
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2.5">
      {!home && (
        <div className="flex items-center border-b border-line/50 pb-1.5">
          <button onClick={() => setSel({ kind, id: 'all' })} className="flex items-center gap-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-soft hover:text-white">
            <ChevronLeft className="h-3.5 w-3.5" /> {label}
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col">
        {Screen ? <Screen key={`${sel.kind}/${sel.id}`} kind={sel.kind} id={id} select={select} /> : <KindBrowser key={`${sel.kind}/${sel.id}`} kind={sel.kind} title={label} empty="Nothing here yet." initial={id} />}
      </div>
    </div>
  )
}

export function SidePanel() {
  const [prefs, save] = usePrefs()
  const { tabs: baseTabs, ctx, sessionId, items } = useTabs()
  const kindList = useKindList()
  const pinned = useApp((s) => s.settings?.trayKinds) ?? []
  const activeKind = prefs.tab.startsWith(KIND_TAB) ? prefs.tab.slice(KIND_TAB.length) : null
  const allKindKeys = [...new Set([...pinned, ...(activeKind ? [activeKind] : [])])]
  const kindTabs: SideTabDef[] = allKindKeys.flatMap((k, i) => {
    const info = kindList.find((x) => x.kind === k)
    if (!info) return []
    return [{ id: `${KIND_TAB}${k}`, label: info.plural, icon: <KindIcon name={info.icon} className="h-3.5 w-3.5" />, order: 1000 + i, render: () => <KindTab kind={k} label={info.plural} /> }]
  })
  const tabs = [...baseTabs, ...kindTabs]
  const seen = usePanel((s) => s.seen)
  const current = tabs.find((t) => t.id === prefs.tab) ?? tabs[0]

  useEffect(() => {
    if (prefs.open && sessionId && current) usePanel.getState().markSeen(sessionId, current.id)
  }, [prefs.open, sessionId, current?.id, items])

  if (!prefs.open || !current) return null

  return (
    <>
    <div
      aria-hidden
      onClick={() => save({ open: false })}
      className="hidden phone:block absolute inset-0 z-20 bg-black/60 backdrop-blur-[1px]"
    />
    <Gutter resets="side" />
    <SidePane
      id="side"
      width={prefs.width}
      min={MIN}
      max={MAX}
      reset={DEFAULTS.width}
      onWidth={(w) => save({ width: w })}
      className="phone:absolute phone:inset-y-0 phone:right-0 phone:z-30 phone:w-[min(22rem,92vw)]! phone:max-w-[92vw]! phone:bg-bg phone:shadow-[-8px_0_24px_rgba(0,0,0,0.7)]"
    >
    <motion.div className="flex h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
      <section className="panel-box flex min-h-0 w-full flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-1 border-b border-line/60 px-2 py-1.5">
          <button
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              openMenu({ preventDefault() {}, stopPropagation() {}, clientX: r.left, clientY: r.bottom + 4 }, 'Side panel', [
                ...tabs.map((tab) => {
                  const fresh = sessionId && tab.id !== current.id ? unseenIn(items, seen, sessionId, tab.id) : 0
                  return { label: `${tab.label}${fresh > 0 ? `  · ${fresh} new` : ''}${tab.id === current.id ? '  ✓' : ''}`, icon: tab.icon, onSelect: () => save({ tab: tab.id }) }
                }),
                ...(kindList.length
                  ? [
                      { label: '', separator: true },
                      {
                        label: 'All Kinds',
                        icon: <Database className="h-3.5 w-3.5" />,
                        children: kindList
                          .filter((k) => !tabs.some((t) => t.id === `${KIND_TAB}${k.kind}`))
                          .sort((a, b) => a.plural.localeCompare(b.plural))
                          .map((k) => ({
                            label: k.plural,
                            icon: <KindIcon name={k.icon} />,
                            onSelect: () => save({ tab: `${KIND_TAB}${k.kind}` })
                          }))
                      }
                    ]
                  : [])
              ])
            }}
            className="flex min-w-0 flex-1 items-center gap-2 border border-accent/60 bg-accent/10 px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent hover:bg-accent/15"
          >
            {current.icon}
            <span className="truncate">{current.label}</span>
            {tabs.some((tab) => sessionId && tab.id !== current.id && unseenIn(items, seen, sessionId, tab.id) > 0) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
            <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0" />
          </button>
          <button title="Hide side panel" onClick={() => save({ open: false })} className="flex h-6 w-6 shrink-0 items-center justify-center text-dim hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{current.render(ctx)}</div>
      </section>
    </motion.div>
    </SidePane>
    </>
  )
}

interface TrayState {
  tab: string | null
  expanded: boolean
  set: (patch: Partial<Pick<TrayState, 'tab' | 'expanded'>>) => void
}

export const useTray = create<TrayState>((set) => ({
  tab: null,
  expanded: false,
  set: (patch) => set(patch)
}))

export function OutputTray() {
  const { tabs: allBuiltIn, ctx, sessionId, items } = useTabs()
  const pinned = useApp((s) => s.settings?.trayKinds) ?? []
  const shownTabs = useApp((s) => s.settings?.trayTabs) ?? []
  const saveTrayTabs = (next: string[]) => void useApp.getState().updateSettings({ trayTabs: next })
  const builtIn = allBuiltIn.filter((t) => shownTabs.includes(t.id))
  const hiddenBuiltIn = allBuiltIn.filter((t) => !shownTabs.includes(t.id))
  const kindList = useKindList()
  const kindTabs: SideTabDef[] = pinned.flatMap((k, i) => {
    const info = kindList.find((x) => x.kind === k)
    if (!info) return []
    return [{ id: `${KIND_TAB}${k}`, label: info.plural, icon: <KindIcon name={info.icon} className="h-3.5 w-3.5" />, order: 1000 + i, render: () => <KindTab kind={k} label={info.plural} /> }]
  })
  const tabs = [...builtIn, ...kindTabs]
  const addMenu = (e: React.MouseEvent) =>
    openMenu(
      e,
      'Add a button',
      [
        ...hiddenBuiltIn.map((t) => ({ label: t.label, icon: t.icon, onSelect: () => saveTrayTabs([...shownTabs, t.id]) })),
        ...(hiddenBuiltIn.length ? [{ label: '', separator: true }] : []),
        ...(kindList.length
          ? kindList
              .filter((k) => !pinned.includes(k.kind))
              .sort((a, b) => a.plural.localeCompare(b.plural))
              .map((k) => ({ label: k.plural, icon: <KindIcon name={k.icon} />, onSelect: () => saveTrayKinds([...pinned, k.kind]) }))
          : [{ label: 'Loading kinds…', disabled: true }])
      ]
    )
  const seen = usePanel((s) => s.seen)
  const tab = useTray((s) => s.tab)
  const expanded = useTray((s) => s.expanded)
  const setTray = useTray((s) => s.set)
  const current = tabs.find((t) => t.id === tab) ?? null
  const [shown, setShown] = useState<typeof current>(current)
  useEffect(() => {
    if (current) {
      setShown(current)
      return undefined
    }
    const timer = setTimeout(() => setShown(null), 260)
    return () => clearTimeout(timer)
  }, [current?.id])
  useEffect(() => {
    if (current && sessionId) usePanel.getState().markSeen(sessionId, current.id)
  }, [current?.id, sessionId, items])
  if (!tabs.length) return null
  return (
    <div className="relative z-20">
      <div className={cn('pointer-events-none absolute inset-x-2 bottom-full overflow-hidden transition-[height] duration-300', expanded ? 'h-[78vh]' : 'h-[44vh]')}>
        <section
          className={cn(
            'panel-box pointer-events-auto absolute inset-0 flex flex-col overflow-hidden border-b-0 shadow-[0_-12px_30px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-out',
            current ? 'translate-y-0' : 'translate-y-full'
          )}
        >
          {shown && (
            <>
              <header className="flex shrink-0 items-center gap-2 border-b border-line/50 px-2.5 py-1.5">
                <span className="flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent">
                  {shown.icon}
                  {shown.label}
                </span>
                <button title={expanded ? 'Shrink' : 'Expand'} onClick={() => setTray({ expanded: !expanded })} className="ml-auto flex h-6 w-6 items-center justify-center text-dim hover:text-white">
                  {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
                <button title="Hide" onClick={() => setTray({ tab: null })} className="flex h-6 w-6 items-center justify-center text-dim hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </header>
              <div className="flex min-h-0 flex-1 flex-col">{shown.render(ctx)}</div>
            </>
          )}
        </section>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 bg-black/40 px-3 pt-2">
        {tabs.map((t) => {
          const active = t.id === tab
          const fresh = !active && sessionId ? unseenIn(items, seen, sessionId, t.id) : 0
          return (
            <button
              key={t.id}
              onClick={() => setTray({ tab: active ? null : t.id })}
              onContextMenu={(e) => {
                if (!t.id.startsWith(KIND_TAB))
                  return openMenu(e, t.label, [
                    {
                      label: 'Remove button',
                      icon: <X />,
                      danger: true,
                      onSelect: () => {
                        if (active) setTray({ tab: null })
                        saveTrayTabs(shownTabs.filter((x) => x !== t.id))
                      }
                    }
                  ])
                const k = t.id.slice(KIND_TAB.length)
                const at = pinned.indexOf(k)
                const move = (to: number) => {
                  const next = pinned.filter((x) => x !== k)
                  next.splice(to, 0, k)
                  saveTrayKinds(next)
                }
                openMenu(e, t.label, [
                  { label: 'Move left', disabled: at <= 0, onSelect: () => move(at - 1) },
                  { label: 'Move right', disabled: at >= pinned.length - 1, onSelect: () => move(at + 1) },
                  { label: '', separator: true },
                  {
                    label: 'Remove button',
                    icon: <X />,
                    danger: true,
                    onSelect: () => {
                      if (active) setTray({ tab: null })
                      saveTrayKinds(pinned.filter((x) => x !== k))
                    }
                  }
                ])
              }}
              className={cn(
                'relative flex h-6 items-center gap-1.5 border px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors',
                active ? 'border-accent/70 bg-accent/15 text-accent' : 'border-line/50 text-dim hover:border-line hover:text-white'
              )}
            >
              {t.icon}
              {t.label}
              {fresh > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent" />}
            </button>
          )
        })}
        <button
          title="Add a button"
          onClick={addMenu}
          className="flex h-6 w-6 items-center justify-center border border-dashed border-line/50 text-dim hover:border-accent/60 hover:text-accent"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
