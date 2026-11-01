import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { LayoutDashboard, Maximize2, MessageSquare, MessagesSquare, Minus, SlidersHorizontal, X } from 'lucide-react'
import type { OverlayState } from '@shared/types'
import { ContextMenuHost, TooltipHost, Toaster, Popover, SquareButton, SquareIcon } from '../components/ui'
import { LockButton, UnlockDialog, VaultVeil } from '../components/vault/Vault'
import { Thread } from '../components/chat/Thread'
import { AgentAvatar, LookBackground, lookVars, useActiveAgent } from '../components/agents/look'
import { ContextMeter, InstructionsBanner } from '../components/chat/ContextMeter'
import { AgentPresence } from '../components/chat/AgentPresence'
import { ChatSettings } from '../components/chat/ChatSettings'
import { DraftAgentSelect } from '../components/chat/DraftAgentSelect'
import { RecentChats } from '../components/chat/RecentChats'
import { threadProps, useOpenChat } from '../components/chat/useOpenChat'
import { bootstrap } from '../store/bootstrap'
import { useSessions } from '../store/sessions'
import { useModels } from '../store/models'
import { useWindows } from '../store/windows'
import { useEscapeLayer } from '../lib/escape'
import { main, on } from '../lib/ipc'
import { cn } from '../lib/cn'
import { useDashboards } from '../store/dashboards'
import { DashboardIcon } from '../components/dashboards/DashboardIcon'
import { DashboardGrid } from '../components/dashboards/DashboardGrid'
import { WindowProvider } from '../lib/window'
import { conversationOf, useConversation } from '../lib/conversation'

const DRAG_THRESHOLD = 4

function toolbarItems(): number {
  return 2 + useDashboards.getState().list.filter((d) => d.onToolbar).length
}

function SevenButton({ onClick, draggable }: { onClick: () => void; draggable: boolean }) {
  const running = useSessions((s) => Object.values(s.running).some(Boolean))
  const needsInput = useSessions((s) => Object.keys(s.pendingUi).length > 0)
  const loading = useModels((s) => s.host.status === 'loading')
  const start = useRef<{ x: number; y: number } | null>(null)
  const moved = useRef(false)

  const busy = running || loading
  const agent = useActiveAgent()
  const { sessionId: activeId } = useConversation()
  const hasPicture = !!agent?.look.avatar

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.screenX, y: e.screenY }
    moved.current = false
    if (draggable) void main('overlay.dragStart')
  }

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!start.current || moved.current) return
    if (Math.hypot(e.screenX - start.current.x, e.screenY - start.current.y) > DRAG_THRESHOLD) moved.current = true
  }

  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    if (!start.current) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    start.current = null
    if (!draggable) {
      onClick()
      return
    }
    void main('overlay.dragEnd').then(() => {
      if (!moved.current) onClick()
    })
  }

  return (
    <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center" style={lookVars(agent?.look)}>
      <button
        title={needsInput ? 'Seven needs your answer' : draggable ? 'Seven: click to open, drag to move, right-click for the app' : 'Close the toolbar'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={(e) => {
          e.preventDefault()
          void main('app.show', { sessionId: null })
        }}
        className={cn(
          'notch-sm scanlines relative flex h-14 w-14 cursor-pointer select-none items-center justify-center border bg-black/90 transition-shadow',
          needsInput
            ? 'animate-pulse border-accent bg-accent/20 shadow-[0_0_24px_color-mix(in_srgb,var(--color-accent)_70%,transparent)]'
            : busy
              ? 'border-cyan shadow-[0_0_18px_rgba(102,252,241,0.45)]'
              : 'border-accent shadow-[0_0_14px_color-mix(in_srgb,var(--color-accent)_30%,transparent)] hover:shadow-[0_0_22px_color-mix(in_srgb,var(--color-accent)_55%,transparent)]'
        )}
      >
        {hasPicture && <AgentAvatar agent={agent} size={52} sessionId={activeId} className="pointer-events-none absolute inset-[1px] z-[1] border-0" />}
        {(!hasPicture || needsInput) && (
          <span className={cn('relative z-[2] font-mono text-[22px] font-bold', hasPicture && 'bg-black/70 px-1.5', needsInput ? 'text-white' : busy ? 'text-cyan' : 'text-accent')}>
            {needsInput ? '?' : '7'}
          </span>
        )}
        <span className={cn('absolute right-1.5 top-1.5 z-[2] h-1.5 w-1.5', needsInput ? 'bg-white' : busy ? 'animate-pulse bg-cyan' : 'bg-accent/60')} />
      </button>
    </div>
  )
}

function ToolbarButton({ title, active, alert, onClick, children }: { title: string; active?: boolean; alert?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        'relative flex h-10 w-10 shrink-0 items-center justify-center border bg-black/90 transition-colors [&>svg]:h-[18px] [&>svg]:w-[18px]',
        active ? 'border-accent bg-accent/15 text-white shadow-[0_0_12px_color-mix(in_srgb,var(--color-accent)_35%,transparent)]' : 'border-line text-accent hover:border-accent hover:text-white'
      )}
    >
      {children}
      {alert && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 animate-pulse bg-accent" />}
    </button>
  )
}

function Toolbar({ state, dashboardId, onDashboard }: { state: OverlayState; dashboardId: string | null; onDashboard: (id: string) => void }) {
  const all = useDashboards((s) => s.list)
  const dashboards = useMemo(() => all.filter((d) => d.onToolbar), [all])
  const needsInput = useSessions((s) => Object.keys(s.pendingUi).length > 0)
  const chatOpen = state.mode === 'panel' && state.panel === 'chat'
  return (
    <div className={cn('flex w-[72px] shrink-0 items-center', state.anchor.bottom ? 'flex-col-reverse' : 'flex-col')}>
      <SevenButton draggable={false} onClick={() => void main('overlay.setMode', { mode: 'button' })} />
      <div className={cn('flex flex-col items-center gap-2 py-1', state.anchor.bottom && 'flex-col-reverse')}>
        <ToolbarButton
          title="Chat"
          active={chatOpen}
          alert={needsInput && !chatOpen}
          onClick={() => void main('overlay.setMode', chatOpen ? { mode: 'toolbar' } : { mode: 'panel', panel: 'chat', focus: true })}
        >
          <MessageSquare />
        </ToolbarButton>
        {dashboards.map((d) => {
          const open = state.mode === 'panel' && state.panel === 'dashboard' && dashboardId === d.id
          return (
            <ToolbarButton
              key={d.id}
              title={d.name}
              active={open}
              onClick={() => {
                if (open) void main('overlay.setMode', { mode: 'toolbar' })
                else {
                  onDashboard(d.id)
                  void main('overlay.setMode', { mode: 'panel', panel: 'dashboard', focus: true })
                }
              }}
            >
              <DashboardIcon name={d.icon} />
            </ToolbarButton>
          )
        })}
        <ToolbarButton title="Open the app" onClick={() => void main('app.show', { sessionId: null })}>
          <Maximize2 />
        </ToolbarButton>
      </div>
    </div>
  )
}

function DashboardPanel({ dashboardId }: { dashboardId: string | null }) {
  const dashboard = useDashboards((s) => s.list.find((d) => d.id === dashboardId))
  const setActive = useDashboards((s) => s.setActive)
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden border border-accent/70 bg-bg/95 shadow-[0_0_24px_color-mix(in_srgb,var(--color-accent)_15%,transparent)]">
      <header className="scanlines flex h-10 shrink-0 items-center gap-2 border-b border-line bg-gradient-to-r from-accent/10 via-black/60 to-black/80 pl-3">
        {dashboard ? <DashboardIcon name={dashboard.icon} className="relative z-[2] h-4 w-4 text-accent" /> : <LayoutDashboard className="relative z-[2] h-4 w-4 text-accent" />}
        <span className="relative z-[2] font-mono text-[13px] font-semibold uppercase tracking-[0.12em] text-white">{dashboard?.name ?? 'Dashboard'}</span>
        <div className="relative z-[2] ml-auto flex h-full">
          {dashboard && (
            <button
              title="Open in app"
              className="flex h-full w-9 items-center justify-center text-dim hover:bg-white/5 hover:text-accent"
              onClick={() => {
                setActive(dashboard.id)
                void main('app.show', { sessionId: null })
              }}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button title="Close (Esc)" className="flex h-full w-10 items-center justify-center text-dim hover:bg-white/5 hover:text-white" onClick={() => void main('overlay.setMode', { mode: 'toolbar' })}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!dashboard ? (
          <div className="p-4 text-[13px] text-dim">This dashboard no longer exists.</div>
        ) : dashboard.widgets.length === 0 ? (
          <div className="p-4 text-[13px] text-dim">No widgets yet. Ask an agent to add some, or add them in the app.</div>
        ) : (
          <DashboardGrid key={dashboard.id} dashboard={dashboard} editable={false} compact />
        )}
      </div>
      <Toaster placement="overlay" />
      <ContextMenuHost />
      <TooltipHost />
      <UnlockDialog />
    </div>
  )
}

function OverlayBar() {
  const chat = useOpenChat()
  const { conv, active, agent, agentId } = chat
  return (
    <div style={lookVars(agent?.look)} className="notch relative flex h-full min-w-0 flex-1 flex-col overflow-hidden border border-line bg-bg/95 shadow-[0_0_24px_color-mix(in_srgb,var(--color-accent)_15%,transparent)]">
      <LookBackground look={agent?.look} />
      <div className="hud-scan pointer-events-none absolute inset-0" />
      <header className="drag relative z-[2] flex shrink-0 items-center gap-1.5 border-b border-line/60 bg-gradient-to-r from-accent/10 via-black/60 to-black/80 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <AgentPresence agent={agent} sessionId={conv.sessionId} size="bar" eyebrow={active?.title ?? 'New chat'} />
        </div>
        <div className="no-drag flex shrink-0 items-center gap-1.5">
        <Popover
          title="Chats"
          trigger={
            <SquareIcon>
              <MessagesSquare />
            </SquareIcon>
          }
        >
          {(close) => <RecentChats conv={conv} onPick={close} />}
        </Popover>
        <ChatSettings
          agent={agent}
          trigger={
            <SquareIcon>
              <SlidersHorizontal />
            </SquareIcon>
          }
        />
        <SquareButton title="Open in app" onClick={() => void main('app.show', { sessionId: conv.sessionId })}>
          <Maximize2 />
        </SquareButton>
        <SquareButton title="Close (Esc)" onClick={() => void main('overlay.setMode', { mode: 'toolbar' })}>
          <Minus />
        </SquareButton>
        </div>
      </header>
      <div className="relative z-[2] flex h-9 shrink-0 items-center gap-2 border-b border-line/40 px-3">
        {!active && <DraftAgentSelect conv={conv} agentId={agentId} />}
        <div className="ml-auto flex h-full items-center gap-2">
          <ContextMeter compact />
          <LockButton compact />
        </div>
      </div>
      <InstructionsBanner />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <VaultVeil agentId={agentId} />
        <Thread key={conv.sessionId ?? 'new'} look="slate" {...threadProps(chat, 'No model is loaded. Open the app to load one.')} />
      </div>
      <Toaster placement="overlay" />
      <ContextMenuHost />
      <TooltipHost />
      <UnlockDialog />
    </div>
  )
}

export function Overlay() {
  return (
    <WindowProvider id="overlay" app="chats" focused>
      <OverlayWindow />
    </WindowProvider>
  )
}

function OverlayWindow() {
  const [state, setState] = useState<OverlayState>({ mode: 'button', panel: null, anchor: { right: true, bottom: true } })
  const [dashboardId, setDashboardId] = useState<string | null>(null)
  const toolbarCount = useDashboards((s) => s.list.filter((d) => d.onToolbar).length)

  useEffect(() => {
    void bootstrap('overlay')
    void main('overlay.state').then(setState)
    return on('overlay.state', setState)
  }, [])

  useEffect(() => {
    if (state.mode === 'button') return
    void main('overlay.setMode', { mode: state.mode, panel: state.panel, items: 2 + toolbarCount })
  }, [toolbarCount, state.mode === 'button'])

  const sessionId = useWindows((s) => s.locations.overlay)
  const shownSince = useRef(0)
  useEffect(() => {
    shownSince.current = Date.now()
  }, [sessionId])

  useEffect(() => {
    if (!(state.mode === 'panel' && state.panel === 'chat')) return
    const conv = conversationOf('overlay')
    const sessions = useSessions.getState()
    const waiting = Object.values(sessions.pendingUi)
    if (waiting.length) {
      if (!waiting.includes(conv.sessionId ?? '')) conv.go(waiting[0])
      return
    }
    const newest = sessions.list[0]
    if (newest && newest.id !== conv.sessionId && newest.updatedAt > shownSince.current) conv.go(newest.id)
  }, [state.mode, state.panel])

  useEscapeLayer(state.mode !== 'button', () => void main('overlay.setMode', { mode: state.mode === 'panel' ? 'toolbar' : 'button' }))

  if (state.mode === 'button') {
    return (
      <div className="h-full w-full">
        <SevenButton draggable onClick={() => void main('overlay.setMode', { mode: 'toolbar', items: toolbarItems(), focus: true })} />
      </div>
    )
  }

  return (
    <div className={cn('flex h-full w-full gap-2', state.anchor.right ? 'flex-row-reverse' : 'flex-row', state.anchor.bottom ? 'items-end' : 'items-start')}>
      <Toolbar state={state} dashboardId={dashboardId} onDashboard={setDashboardId} />
      {state.mode === 'panel' && (
        <div className="flex h-full min-w-0 flex-1">{state.panel === 'dashboard' ? <DashboardPanel dashboardId={dashboardId} /> : <OverlayBar />}</div>
      )}
    </div>
  )
}
