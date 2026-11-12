import { useEffect, useRef, useState } from 'react'
import { Bell, HelpCircle, KeyRound, ListChecks, ShieldAlert } from 'lucide-react'
import type { PendingRequest, UiRequestKind } from '@shared/types'
import type { TimelineRow } from '@shared/timeline'
import { engine, on } from '../../lib/ipc'
import { KindIcon, onLibraryChange, openChat, openEntry } from '../../lib/library'
import { formatRelative } from '../../lib/format'
import { useSessions } from '../../store/sessions'
import { useHasForm } from '../../lib/form'
import { useSheet } from '../../lib/sheet'
import { Sheet } from '../ui'
import { NavButton } from './NavButton'

const KIND_ICON: Partial<Record<UiRequestKind, React.ReactNode>> = {
  approval: <ShieldAlert />,
  unlock: <KeyRound />,
  form: <ListChecks />
}

function usePending(): PendingRequest[] {
  const [list, setList] = useState<PendingRequest[]>([])
  useEffect(() => {
    void engine('ui.pending')
      .then(setList)
      .catch(() => undefined)
    return on('ui.pending', setList)
  }, [])
  return list
}

function useRecent(open: boolean): TimelineRow[] | null {
  const [rows, setRows] = useState<TimelineRow[] | null>(null)
  useEffect(() => {
    if (!open) return
    const load = () =>
      void engine('timeline.recent', { limit: 30 })
        .then(setRows)
        .catch(() => setRows([]))
    load()
    return onLibraryChange(load)
  }, [open])
  return rows
}

function Heading({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-2 px-3 pb-1 pt-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-soft">
      {children}
      {count !== undefined && count > 0 && <span className="font-normal text-faint">{count}</span>}
    </div>
  )
}

function NotificationList({ open, pending, onGo }: { open: boolean; pending: PendingRequest[]; onGo: (fn: () => void) => void }) {
  const recent = useRecent(open)
  const sessions = useSessions((s) => s.list)
  const chatTitle = (id: string) => sessions.find((s) => s.id === id)?.title ?? 'a chat'
  return (
    <>
      <Heading count={pending.length}>Waiting for you</Heading>
      {!pending.length ? (
        <div className="px-3 pb-1 text-[12px] text-faint">Nothing waiting.</div>
      ) : (
        pending.map((p) => (
          <button key={p.id} onClick={() => onGo(() => openChat(p.sessionId))} className="flex w-full items-start gap-2.5 border-l-2 border-l-accent px-3 py-1.5 text-left hover:bg-accent/[0.06] touch:py-2.5">
            <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 text-accent [&>svg]:h-3.5 [&>svg]:w-3.5">{KIND_ICON[p.kind] ?? <HelpCircle />}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] text-white phone:text-[14px]">{p.label || p.tool || p.kind}</span>
              <span className="block truncate text-[11px] text-dim phone:text-[12px]">
                {chatTitle(p.sessionId)} · {formatRelative(p.at)}
              </span>
            </span>
          </button>
        ))
      )}
      <Heading>Recent</Heading>
      {recent === null ? (
        <div className="px-3 font-mono text-[11px] text-dim">Loading…</div>
      ) : !recent.length ? (
        <div className="px-3 text-[12px] text-faint">Nothing yet.</div>
      ) : (
        recent.map((r) => (
          <button key={`${r.kind}/${r.id}/${r.at}`} onClick={() => onGo(() => openEntry(r.kind, r.id))} className="flex w-full items-center gap-2.5 px-3 py-1 text-left hover:bg-white/[0.04] touch:py-2.5 phone:flex-wrap phone:gap-x-2.5 phone:gap-y-0.5">
            <KindIcon name={r.icon} className="h-3.5 w-3.5 shrink-0 text-dim" />
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/85 phone:text-[14px]">{r.title}</span>
            <span className="shrink-0 text-[11px] text-faint phone:w-full phone:pl-6 phone:text-[12px]">
              {r.what} · {formatRelative(r.at)}
            </span>
          </button>
        ))
      )}
    </>
  )
}

function BellButton({ open, count, onClick }: { open: boolean; count: number; onClick: () => void }) {
  return (
    <NavButton label="Notifications" title={count ? `${count} waiting for you` : 'Notifications'} active={open} lit={count > 0} onClick={onClick}>
      <Bell />
      {count > 0 && (
        <span className="absolute right-1.5 top-2 flex h-3.5 min-w-3.5 items-center justify-center bg-accent px-0.5 font-mono text-[9px] font-bold text-black">{count}</span>
      )}
    </NavButton>
  )
}

function DesktopNotifications() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const pending = usePending()

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', key)
    }
  }, [open])

  const go = (fn: () => void) => {
    setOpen(false)
    fn()
  }

  return (
    <div ref={box} className="relative flex items-stretch">
      <BellButton open={open} count={pending.length} onClick={() => setOpen(!open)} />
      {open && (
        <div className="absolute right-0 bottom-full z-50 mb-2 flex max-h-[70vh] w-96 flex-col border border-line bg-bg/95 shadow-[0_0_24px_rgba(0,0,0,0.6)] backdrop-blur-sm">
          <div className="min-h-0 flex-1 overflow-y-auto pb-1.5">
            <NotificationList open={open} pending={pending} onGo={go} />
          </div>
        </div>
      )}
    </div>
  )
}

function SheetNotifications() {
  const sheet = useSheet('notifications')
  const pending = usePending()
  const go = (fn: () => void) => {
    sheet.close()
    fn()
  }
  return (
    <div className="relative flex items-stretch">
      <BellButton open={sheet.open} count={pending.length} onClick={sheet.toggle} />
      <Sheet open={sheet.open} onClose={sheet.close} title="Notifications" bodyClassName="overflow-y-auto pb-2">
        <NotificationList open={sheet.open} pending={pending} onGo={go} />
      </Sheet>
    </div>
  )
}

export function NotificationButton() {
  return useHasForm() ? <SheetNotifications /> : <DesktopNotifications />
}
