import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Clapperboard,
  Eye,
  Grid,
  ImageIcon,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  MessageSquare,
  Pin,
  Plus,
  SlidersHorizontal,
  UserRound,
  WalletCards
} from 'lucide-react'
import type { AgentProfile, CharacterSheet } from '@shared/types'
import { showName } from '@shared/ids'
import { engine, on } from '../../lib/ipc'
import { cn } from '../../lib/cn'
import { useLive } from '../../lib/useLive'
import { onLibraryChange } from '../../lib/library'
import { openSevenLink } from '../../lib/links'
import { failed } from '../../lib/notify'
import { useDashboards } from '../../store/dashboards'
import { askText, Button, openMenu, Popover, Select } from '../ui'
import { AddPicker } from '../dashboards/AddPicker'
import { BoardTabletop } from '../dashboards/BoardTabletop'
import { BackdropPicker } from '../backdrop/Backdrop'
import { SlateContainer } from '../entries/EntrySlate'
import { SheetCard } from '../data/SheetCard'
import {
  ensureActiveDashboard,
  useBoardSurfaces,
  useChatDashboard,
  useSurfaceSwitcher,
  useTabletopMode
} from './tabletopStore'
import { useConversation } from '../../lib/conversation'
import { setChatViewMode } from '../../lib/chatViewMode'
import { ChatViewModeButton } from './ChatViewModeButton'

function useCharacterSheets(): CharacterSheet[] {
  const [sheets, setSheets] = useState<CharacterSheet[]>([])
  useEffect(() => {
    let alive = true
    const load = () =>
      void engine('sheets.list')
        .then((list) => alive && setSheets(list))
        .catch(() => undefined)
    load()
    const offLib = onLibraryChange(load)
    const offPage = on('page.changed', load)
    return () => {
      alive = false
      offLib()
      offPage()
    }
  }, [])
  return sheets
}

export function UserBoardBar() {
  const [mode, setMode] = useTabletopMode()
  const { sessionId } = useConversation()
  const [dashboard, selectDashboard] = useChatDashboard(sessionId)
  const { state: surfaces, activeSlot, setActiveSurface } = useBoardSurfaces(dashboard?.id ?? null)
  const switcherOpen = useSurfaceSwitcher((s) => s.open)
  const toggleSwitcher = useSurfaceSwitcher((s) => s.toggle)
  const [editingBackdrop, setEditingBackdrop] = useState(false)
  const boards = useDashboards((s) => s.list)
  const [addingWidget, setAddingWidget] = useState(false)
  const sheets = useCharacterSheets()

  const createNewBoard = () => {
    askText('New Board', 'Board name', `Board ${boards.length + 1}`, async (name) => {
      if (!name.trim()) return
      try {
        const created = await engine('dashboards.create', {
          name: name.trim(),
          icon: 'layout-dashboard',
          onToolbar: true
        })
        await useDashboards.getState().refresh()
        selectDashboard(created.id)
      } catch (err) {
        failed('Could not create board')(err)
      }
    })
  }

  const openAddPicker = () => {
    if (dashboard) {
      setAddingWidget(true)
      return
    }
    void ensureActiveDashboard(sessionId)
      .then((d) => {
        selectDashboard(d.id)
        setAddingWidget(true)
      })
      .catch(failed('Could not create board'))
  }

  const decksToggle = (
    <button
      type="button"
      onClick={() => setMode({ showDecks: !mode.showDecks })}
      title={mode.showDecks ? 'Hide card decks on chat' : 'Show card decks on chat'}
      className={cn(
        'flex h-6 w-fit shrink-0 items-center gap-1 border px-1.5 font-label text-[9.5px] caps-5 transition-colors cursor-pointer',
        mode.showDecks
          ? 'border-accent/70 bg-accent/15 text-accent'
          : 'border-line/60 tone-well-60 text-dim hover:border-accent hover:text-ink'
      )}
    >
      <WalletCards className="h-3 w-3" />
      <span>Decks</span>
    </button>
  )

  if (!mode.windowed) {
    return (
      <div className="flex items-center gap-1">
        <ChatViewModeButton />
        {decksToggle}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <ChatViewModeButton />
      {dashboard && mode.layoutMode !== 'creator' && (
        <div className="flex items-center">
          <Select
            value={activeSlot.id}
            options={surfaces.slots.map((s) => ({
              value: s.id,
              label: `${s.index}: ${s.label}`
            }))}
            onChange={setActiveSurface}
            className="h-6 w-32 font-ui text-[10px]"
          />
          <button
            type="button"
            onClick={toggleSwitcher}
            title="SurfaceTop Overview Switcher (Ctrl+Space)"
            className={cn(
              'flex h-6 items-center gap-1 border border-l-0 px-1.5 font-label text-[9.5px] caps transition-colors cursor-pointer',
              switcherOpen
                ? 'border-accent bg-accent/20 text-accent'
                : 'border-line/60 tone-well-60 text-dim hover:border-accent hover:text-ink'
            )}
          >
            <Layers className="h-3 w-3" />
          </button>
        </div>
      )}

      {decksToggle}

      {mode.layoutMode === 'creator' && sheets.length > 0 && (
        <Select
          value={mode.creatorSheetId ?? sheets[0]?.id ?? ''}
          options={sheets.map((s) => ({ value: s.id, label: showName(s.title) }))}
          onChange={(creatorSheetId) => setMode({ creatorSheetId })}
          className="h-6 w-36 font-ui text-[10px]"
        />
      )}

      {mode.layoutMode !== 'creator' && (
        <>
          <button
            type="button"
            onClick={() => setMode({ pinnedChat: !mode.pinnedChat, peekTable: false })}
            title={
              mode.pinnedChat
                ? 'Chat is pinned open in foreground (click to let chat recede when inspecting tabletop)'
                : 'Pin chat open in foreground'
            }
            className={cn(
              'flex h-6 items-center gap-1 border px-1.5 font-label text-[9.5px] caps-5 transition-colors cursor-pointer',
              mode.pinnedChat
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-line/60 tone-well-60 text-dim hover:border-accent hover:text-ink'
            )}
          >
            <Pin className="h-3 w-3" />
            <span>{mode.pinnedChat ? 'Pinned' : 'Pin'}</span>
          </button>

          <button
            type="button"
            onClick={openAddPicker}
            title="Add entry or widget to this SurfaceTop"
            className="flex h-6 items-center gap-1 border border-line/60 tone-well-60 px-1.5 font-label text-[9.5px] caps-5 text-dim hover:border-accent hover:text-ink cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            <span>Add</span>
          </button>
        </>
      )}

      <Popover
        title="Board options"
        side="top"
        align="start"
        className="flex w-72 flex-col gap-2.5 p-3 font-ui text-[11px]"
        triggerClassName="flex h-6 w-6 items-center justify-center border border-line/60 tone-well-60 text-dim hover:border-accent hover:text-ink"
        trigger={<SlidersHorizontal className="h-3 w-3" />}
      >
        <div className="flex flex-col gap-1">
          <span className="text-[9.5px] font-bold caps-16 text-accent-soft">Active Board</span>
          <div className="flex items-center gap-1">
            {boards.length > 0 ? (
              <Select
                value={dashboard?.id ?? ''}
                options={boards.map((b) => ({ value: b.id, label: `${b.name} (${b.widgets.length})` }))}
                onChange={selectDashboard}
                className="h-7 flex-1 text-[11px]"
              />
            ) : (
              <span className="flex-1 text-dim">No boards yet</span>
            )}
            <Button size="sm" variant="ghost" icon={<Plus />} onClick={createNewBoard} title="New board" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[9.5px] font-bold caps-16 text-accent-soft">Layout</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMode({ layoutMode: 'tabletop', editingGrid: false })}
              className={cn(
                'flex h-7 flex-1 items-center justify-center gap-1 border text-[10px] font-semibold caps cursor-pointer',
                mode.layoutMode === 'tabletop'
                  ? 'border-accent bg-accent/20 text-accent'
                  : 'border-line/60 tone-well-50 text-dim hover:text-ink'
              )}
            >
              <LayoutGrid className="h-3 w-3" />
              <span>Tabletop</span>
            </button>
            <button
              type="button"
              onClick={() => setMode({ layoutMode: 'grid' })}
              className={cn(
                'flex h-7 flex-1 items-center justify-center gap-1 border text-[10px] font-semibold caps cursor-pointer',
                mode.layoutMode === 'grid'
                  ? 'border-accent bg-accent/20 text-accent'
                  : 'border-line/60 tone-well-50 text-dim hover:text-ink'
              )}
            >
              <Grid className="h-3 w-3" />
              <span>Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setMode({ layoutMode: 'creator' })}
              title="Dual-panel Character Creator: Character Sheet on the left, Chat on the right"
              className={cn(
                'flex h-7 flex-1 items-center justify-center gap-1 border text-[10px] font-semibold caps cursor-pointer',
                mode.layoutMode === 'creator'
                  ? 'border-accent bg-accent/20 text-accent'
                  : 'border-line/60 tone-well-50 text-dim hover:text-ink'
              )}
            >
              <UserRound className="h-3 w-3" />
              <span>Creator</span>
            </button>
          </div>
        </div>

        {dashboard && (
          <div className="flex items-center justify-between border-t border-line/40 pt-2">
            <span className="text-[10px] caps text-dim">Surface Background</span>
            <button
              type="button"
              onClick={() => setEditingBackdrop(true)}
              className="flex h-6 items-center gap-1 border border-line/60 tone-well-50 px-2 text-[10px] font-semibold caps text-dim hover:border-accent hover:text-ink cursor-pointer"
            >
              <ImageIcon className="h-3 w-3" />
              <span>{activeSlot.label}…</span>
            </button>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-line/40 pt-2">
          <span className="text-[10px] caps text-dim">Chat Mode</span>
          <button
            type="button"
            onClick={() => setMode({ windowed: false, peekTable: false })}
            className="flex h-6 items-center gap-1 border border-line/60 tone-well-50 px-2 text-[10px] font-semibold caps text-dim hover:border-accent hover:text-ink cursor-pointer"
          >
            <MessageSquare className="h-3 w-3" />
            <span>Default Chat</span>
          </button>
        </div>
      </Popover>

      {addingWidget && dashboard && <AddPicker dashboard={dashboard} onClose={() => setAddingWidget(false)} />}
      {editingBackdrop && dashboard && (
        <BackdropPicker
          sessionId={sessionId}
          surfaceTarget={{ dashboardId: dashboard.id, surfaceId: activeSlot.id, label: activeSlot.label }}
          initialScope="surface"
          onClose={() => setEditingBackdrop(false)}
        />
      )}
    </div>
  )
}

function CharacterCreatorLeftPanel({
  agent,
  worldPlayerSheet
}: {
  agent: AgentProfile | null
  worldPlayerSheet: string | null
}) {
  const [mode, setMode] = useTabletopMode()
  const sheets = useCharacterSheets()
  const defaultSheetId =
    (mode.creatorSheetId && sheets.some((s) => s.id === mode.creatorSheetId) ? mode.creatorSheetId : null) ??
    (worldPlayerSheet && sheets.some((s) => s.id === worldPlayerSheet) ? worldPlayerSheet : null) ??
    (agent?.sheet && sheets.some((s) => s.id === agent.sheet) ? agent.sheet : null) ??
    sheets[0]?.id ??
    null
  const activeSheet = sheets.find((s) => s.id === defaultSheetId) ?? null

  const createNewCharacter = () => {
    askText('New Character', 'Character name', '', async (title) => {
      if (!title.trim()) return
      try {
        const created = await engine('sheets.save', {
          id: null,
          title: title.trim(),
          fields: ['Identity', 'Appearance', 'Personality', 'Backstory', 'Motivations & Goals'],
          values: {}
        })
        setMode({ creatorSheetId: created.id })
      } catch (err) {
        failed('Could not create character sheet')(err)
      }
    })
  }

  return (
    <SlateContainer
      title={activeSheet ? showName(activeSheet.title) : 'Character Creator'}
      tag="Creator"
      entryKey={activeSheet ? `sheet/${activeSheet.id}` : undefined}
      fillCell
      onOpenData={activeSheet ? () => openSevenLink(`seven:sheet/${encodeURIComponent(activeSheet.id)}`) : undefined}
      onRemove={() => setMode({ layoutMode: 'tabletop' })}
      actions={
        <div className="flex items-center gap-1 pr-1">
          {sheets.length > 0 && (
            <Select
              value={activeSheet?.id ?? ''}
              options={sheets.map((s) => ({ value: s.id, label: showName(s.title) }))}
              onChange={(creatorSheetId) => setMode({ creatorSheetId })}
              className="h-5 w-36 font-ui text-[10px]"
            />
          )}
          <button
            type="button"
            onClick={createNewCharacter}
            title="Create new character sheet"
            className="flex h-5 items-center gap-0.5 border border-line/60 tone-well-60 px-1.5 font-label text-[9px] caps-5 text-accent hover:border-accent hover:text-ink cursor-pointer"
          >
            <Plus className="h-2.5 w-2.5" />
            <span>New</span>
          </button>
        </div>
      }
    >
      {activeSheet ? (
        <SheetCard key={activeSheet.id} id={activeSheet.id} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <UserRound className="h-10 w-10 text-dim" />
          <div className="font-label text-[12px] caps-14 text-ink">No character sheet yet</div>
          <p className="max-w-xs text-[12.5px] text-dim">
            Create a character sheet here or ask the agent in chat to create and fill one out with you.
          </p>
          <Button size="sm" variant="primary" icon={<Plus />} onClick={createNewCharacter}>
            New Character Sheet
          </Button>
        </div>
      )}
    </SlateContainer>
  )
}

export function ChatTabletop({
  sessionId,
  agent,
  children
}: {
  sessionId: string | null
  agent: AgentProfile | null
  children: ReactNode
}) {
  const [mode, setMode] = useTabletopMode()
  const [dashboard, selectDashboard] = useChatDashboard(sessionId)
  const { activeSlot } = useBoardSurfaces(dashboard?.id ?? null)
  const toggleSwitcher = useSurfaceSwitcher((s) => s.toggle)
  const boards = useDashboards((s) => s.list)
  const [addingWidget, setAddingWidget] = useState(false)
  const [editingBackdrop, setEditingBackdrop] = useState(false)
  const [creatorSplitPct, setCreatorSplitPct] = useState(50)
  const splitDragRef = useRef<{ startX: number; origPct: number; containerW: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const worlds = useLive(() => engine('worlds.list'), 'worlds.changed') ?? []
  const activeWorld = worlds.find((w) => w.id === agent?.world?.worldId) ?? worlds[0] ?? null
  const ensuringRef = useRef(false)

  useEffect(() => {
    if (!mode.windowed || dashboard || ensuringRef.current) return
    ensuringRef.current = true
    void ensureActiveDashboard(sessionId)
      .then((d) => selectDashboard(d.id))
      .catch(() => undefined)
      .finally(() => {
        ensuringRef.current = false
      })
  }, [mode.windowed, dashboard, sessionId, selectDashboard])

  const ensureBoardThen = (run: () => void) => {
    if (dashboard) {
      run()
      return
    }
    void ensureActiveDashboard(sessionId)
      .then((d) => {
        selectDashboard(d.id)
        run()
      })
      .catch(failed('Could not create tabletop surface'))
  }

  if (!mode.windowed) {
    return <>{children}</>
  }

  const createNewBoard = () => {
    askText('New Board', 'Board name', `Board ${boards.length + 1}`, async (name) => {
      if (!name.trim()) return
      try {
        const created = await engine('dashboards.create', {
          name: name.trim(),
          icon: 'layout-dashboard',
          onToolbar: true
        })
        await useDashboards.getState().refresh()
        selectDashboard(created.id)
      } catch (err) {
        failed('Could not create board')(err)
      }
    })
  }

  if (mode.layoutMode === 'creator') {
    return (
      <div ref={containerRef} className="relative flex min-h-0 flex-1 flex-row overflow-hidden">
        <div
          style={{ width: `${creatorSplitPct}%` }}
          className="flex h-full min-w-[320px] max-w-[72%] shrink-0 flex-col p-2 pr-0"
        >
          <CharacterCreatorLeftPanel agent={agent} worldPlayerSheet={activeWorld?.player ?? null} />
        </div>
        <div
          onPointerDown={(e) => {
            if (e.button !== 0) return
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            const w = containerRef.current?.clientWidth || 1200
            splitDragRef.current = { startX: e.clientX, origPct: creatorSplitPct, containerW: w }
          }}
          onPointerMove={(e) => {
            const d = splitDragRef.current
            if (!d) return
            const deltaPct = ((e.clientX - d.startX) / d.containerW) * 100
            setCreatorSplitPct(Math.max(28, Math.min(70, Math.round((d.origPct + deltaPct) * 10) / 10)))
          }}
          onPointerUp={(e) => {
            if (!splitDragRef.current) return
            splitDragRef.current = null
            if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
          }}
          className="group flex w-2.5 shrink-0 cursor-col-resize items-center justify-center"
        >
          <span className="h-16 w-0.5 bg-line/60 transition-colors group-hover:bg-accent" />
        </div>
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    )
  }

  return (
    <div
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest('[data-slate], input, textarea, button, a')) return
        openMenu(e, dashboard ? `Tabletop · ${dashboard.name}` : 'Tabletop', [
          {
            label: 'Add slate or widget…',
            icon: <Plus />,
            onSelect: () => ensureBoardThen(() => setAddingWidget(true))
          },
          { label: '', separator: true },
          {
            label: 'Surface & Background',
            icon: <Layers />,
            children: [
              {
                label: `Surface background (${activeSlot.label})…`,
                icon: <ImageIcon />,
                onSelect: () => ensureBoardThen(() => setEditingBackdrop(true))
              },
              {
                label: 'SurfaceTop Overview (Ctrl+Space)',
                icon: <Layers />,
                onSelect: toggleSwitcher
              },
              { label: '', separator: true },
              { label: 'New board…', icon: <Plus />, onSelect: createNewBoard }
            ]
          },
          {
            label: 'Layout & Chat',
            icon: <LayoutGrid />,
            children: [
              {
                label: mode.pinnedChat ? 'Unpin chat (auto-recede when inspecting board)' : 'Pin chat open',
                icon: <Pin />,
                onSelect: () => setMode({ pinnedChat: !mode.pinnedChat })
              },
              {
                label: mode.peekTable ? 'Show chat' : 'Hide chat completely',
                icon: mode.peekTable ? <MessageSquare /> : <Eye />,
                onSelect: () => setMode({ peekTable: !mode.peekTable })
              },
              { label: '', separator: true },
              {
                label: mode.layoutMode === 'grid' ? 'Switch to Tabletop slates' : 'Switch to Resizable Grid',
                icon: mode.layoutMode === 'grid' ? <LayoutGrid /> : <Grid />,
                onSelect: () => setMode({ layoutMode: mode.layoutMode === 'grid' ? 'tabletop' : 'grid' })
              },
              {
                label: 'Character Creator (Dual-Panel)',
                icon: <UserRound />,
                onSelect: () => setMode({ layoutMode: 'creator' })
              }
            ]
          },
          {
            label: 'Chat view mode',
            icon: <LayoutDashboard />,
            children: [
              { label: 'Default', icon: <MessageSquare />, onSelect: () => setChatViewMode('default') },
              { label: 'Tabletop', icon: <LayoutDashboard />, onSelect: () => setChatViewMode('tabletop') },
              { label: 'Cinema', icon: <Clapperboard />, onSelect: () => setChatViewMode('cinema') }
            ]
          }
        ])
      }}
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {/* LAYER 2: UNIFIED BOARD SURFACE (SHARES STACKING CONTEXT SO EXPANDED SLATES SIT ABOVE UNPINNED CHAT) */}
      {dashboard && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <BoardTabletop dashboard={dashboard} layoutMode={mode.layoutMode} />
        </div>
      )}

      {/* LAYER 3: FULL-WIDTH CHAT */}
      <div className="pointer-events-none relative flex min-h-0 flex-1 flex-col">
        {children}
      </div>

      {addingWidget && dashboard && <AddPicker dashboard={dashboard} onClose={() => setAddingWidget(false)} />}
      {editingBackdrop && dashboard && (
        <BackdropPicker
          sessionId={sessionId}
          surfaceTarget={{ dashboardId: dashboard.id, surfaceId: activeSlot.id, label: activeSlot.label }}
          initialScope="surface"
          onClose={() => setEditingBackdrop(false)}
        />
      )}
    </div>
  )
}
