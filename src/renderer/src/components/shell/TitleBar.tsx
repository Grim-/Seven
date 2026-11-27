import { ConnectionStatus, SegmentBar } from '../ui'
import { useEffect, useState } from 'react'
import { BookOpen, Brain, Copy, Hourglass, Lock, LockOpen, MessageCircleQuestion, Minus, PenLine, Square, Wrench, X } from 'lucide-react'
import type { TurnPhase } from '@shared/types'
import { main, on } from '../../lib/ipc'
import { allowedRequest } from '../../lib/transport'
import { useSessions } from '../../store/sessions'
import { useAgents } from '../../store/agents'
import { useImageHost } from '../../store/image'
import { useModels } from '../../store/models'
import { useVault } from '../../store/vault'
import { openChat } from '../../lib/library'
import { cn } from '../../lib/cn'
import { failed } from '../../lib/notify'
import { noteFailure } from '../../store/problems'
import { skinSurface } from '../skins/skinSurface'

const pretty = (name: string) => name.replace(/_/g, ' ')

function phaseText(phase: TurnPhase | undefined): { icon: React.ReactNode; text: string } {
  const icon = (node: React.ReactNode) => node
  if (!phase) return { icon: icon(<Hourglass />), text: 'starting' }
  switch (phase.kind) {
    case 'reading':
      return { icon: <BookOpen />, text: phase.tool ? `reading ${pretty(phase.tool)}` : 'reading' }
    case 'thinking':
      return { icon: <Brain />, text: 'thinking' }
    case 'writing':
      return { icon: <PenLine />, text: 'writing' }
    case 'calling':
    case 'tool':
      return { icon: <Wrench />, text: phase.tool ? pretty(phase.tool) : 'using a tool' }
    case 'waiting':
      return { icon: <MessageCircleQuestion />, text: 'waiting for you' }
  }
}

function usePhasesBySession(): Record<string, TurnPhase> {
  const [phases, setPhases] = useState<Record<string, TurnPhase>>({})
  useEffect(() => {
    const offPhase = on('turn.phase', ({ sessionId, phase }) => setPhases((p) => ({ ...p, [sessionId]: phase })))
    const offDone = on('turn.finish', ({ sessionId }) =>
      setPhases((p) => {
        const next = { ...p }
        delete next[sessionId]
        return next
      })
    )
    return () => {
      offPhase()
      offDone()
    }
  }, [])
  return phases
}

function TitleBarHeartbeat({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] overflow-hidden text-accent">
      {/* Full-width repeating ECG heartbeat baseline across the entire title bar */}
      <svg className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <pattern id="seven-ecg-tile" width="180" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M0 22 H52 L58 19 L64 22 H74 L80 26 L87 7 L94 34 L100 17 L105 22 H118 Q125 14 132 22 H180"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#seven-ecg-tile)" opacity="0.22" />
      </svg>

      {/* Traveling bright heartbeat pulse sweeping edge-to-edge across the entire bar */}
      <div
        className="absolute inset-0"
        style={{
          maskImage:
            'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'180\' height=\'40\' viewBox=\'0 0 180 40\'%3E%3Cpath d=\'M0 22 H52 L58 19 L64 22 H74 L80 26 L87 7 L94 34 L100 17 L105 22 H118 Q125 14 132 22 H180\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")',
          WebkitMaskImage:
            'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'180\' height=\'40\' viewBox=\'0 0 180 40\'%3E%3Cpath d=\'M0 22 H52 L58 19 L64 22 H74 L80 26 L87 7 L94 34 L100 17 L105 22 H118 Q125 14 132 22 H180\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")',
          maskRepeat: 'repeat-x',
          WebkitMaskRepeat: 'repeat-x',
          maskSize: '180px 40px',
          WebkitMaskSize: '180px 40px'
        }}
      >
        <div
          className="seven-heartbeat-sweep h-full w-full"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, transparent 38%, color-mix(in srgb, var(--color-accent) 45%, transparent) 44%, var(--color-accent) 52%, color-mix(in srgb, var(--color-ink) 90%, var(--color-accent)) 56%, transparent 62%, transparent 100%)'
          }}
        />
      </div>
    </div>
  )
}

function Activity({ running }: { running: string[] }) {
  const phases = usePhasesBySession()
  const sessions = useSessions((s) => s.list)
  const agents = useAgents((s) => s.list)
  if (!running.length) return null
  const id = running[0]
  const session = sessions.find((x) => x.id === id)
  const agent = agents.find((a) => a.id === session?.agentId)
  const { icon, text } = phaseText(phases[id])
  return (
    <button
      onClick={() => openChat(id)}
      title={session ? `${session.title}: open the chat` : 'Open the chat'}
      className="no-drag relative z-[2] ml-5 flex min-w-0 items-center gap-2 border-l border-line/50 pl-4 font-ui text-[11px] text-ink/85 hover:text-ink phone:ml-2 phone:gap-1.5 phone:pl-2"
    >
      <span className="truncate text-secondary/95">{agent?.name ?? 'Agent'}</span>
      <span className="flex h-3.5 w-3.5 shrink-0 items-center text-dim [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
      <span className="truncate text-dim">{text}</span>
      {running.length > 1 && <span className="shrink-0 border border-line/60 px-1 text-[10px] text-faint">+{running.length - 1}</span>}
    </button>
  )
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(timer)
  }, [])
  return (
    <span className="relative z-[2] flex items-baseline gap-2 font-data tabular-nums">
      <span className="text-[10.5px] caps-14 text-faint phone:hidden">{now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
      <span className="text-[13px] text-ink/85 phone:text-[12px]">{now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
    </span>
  )
}

function VaultGlyph() {
  const status = useVault((s) => s.status)
  const lock = useVault((s) => s.lock)
  const ask = useVault((s) => s.ask)
  if (!status.configured) return null
  return (
    <button
      title={status.unlocked ? 'Vault open: click to lock' : 'Vault locked: click to unlock'}
      onClick={() => (status.unlocked ? void lock().catch(failed('Could not lock')) : ask())}
      className={cn('no-drag relative z-[2] flex h-7 w-7 items-center justify-center', status.unlocked ? 'text-dim hover:text-accent' : 'text-accent hover:text-ink')}
    >
      {status.unlocked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
    </button>
  )
}

function Progress() {
  const host = useModels((s) => s.host)
  if (host.status !== 'loading') return null
  return (
    <SegmentBar thin segments={60} value={host.progress} className="pointer-events-none absolute inset-x-0 bottom-0 z-[3]" />
  )
}

export function TitleBar() {
  const [maximized, setMaximized] = useState(false)
  const runningMap = useSessions((s) => s.running)
  const running = Object.keys(runningMap).filter((id) => runningMap[id])
  const modelLoading = useModels((s) => s.host.status === 'loading')
  const imageBusy = useImageHost(
    (s) => s.generating || s.host.status === 'loading' || s.host.status === 'generating' || s.host.busyCount > 0
  )
  const isRunning = running.length > 0 || modelLoading || imageBusy

  const windowed = allowedRequest('main', 'window.isMaximized')

  useEffect(() => {
    if (!windowed) return
    void main('window.isMaximized').then(setMaximized, noteFailure('window', 'Could not read the window state'))
    return on('window.maximized', setMaximized)
  }, [windowed])

  return (
    <header
      {...skinSurface('top-bar')}
      className="drag scanlines relative z-50 flex h-10 shrink-0 select-none items-center border-b border-line bg-gradient-to-r from-accent/10 via-panel/60 to-panel/80 pl-4 phone:pl-2.5 shadow-[0_10px_30px_color-mix(in_srgb,var(--color-shade)_90%,transparent),var(--shadow-glow)]"
      onDoubleClick={windowed ? () => void main('window.toggleMaximize').then(setMaximized, failed('Could not resize the window')) : undefined}
    >
      <TitleBarHeartbeat active={isRunning} />
      <span className="relative z-[2] shrink-0 font-ui text-[19px] font-light tracking-[0.12em] text-ink phone:text-[15px]">
        <span className="text-accent">//</span>SEVEN
      </span>
      <Activity running={running} />
      <div className="relative z-[2] ml-auto flex items-center gap-3 pr-3 phone:gap-1.5 phone:pr-2">
        <ConnectionStatus />
        <Clock />
        <VaultGlyph />
      </div>
      {windowed && <div className="no-drag relative z-[2] flex h-full">
        <button className="flex h-full w-12 items-center justify-center text-dim hover:bg-ink/5 hover:text-ink" onClick={() => void main('window.minimize').catch(failed('Could not minimise the window'))}>
          <Minus className="h-4 w-4" />
        </button>
        <button
          className="flex h-full w-12 items-center justify-center text-dim hover:bg-ink/5 hover:text-ink"
          onClick={() => void main('window.toggleMaximize').then(setMaximized, failed('Could not resize the window'))}
        >
          {maximized ? <Copy className="h-3.5 w-3.5 -scale-x-100" /> : <Square className="h-3.5 w-3.5" />}
        </button>
        <button className="flex h-full w-12 items-center justify-center text-dim hover:bg-alert hover:text-ink" onClick={() => void main('window.close').catch(failed('Could not close the window'))}>
          <X className="h-4 w-4" />
        </button>
      </div>}
      <Progress />
    </header>
  )
}
