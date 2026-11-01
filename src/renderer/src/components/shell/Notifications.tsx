import { useEffect, useRef, useState } from 'react'
import { Bell, HelpCircle, KeyRound, ListChecks, ShieldAlert } from 'lucide-react'
import type { PendingRequest, UiRequestKind } from '@shared/types'
import type { TimelineRow } from '@shared/timeline'
import { engine, on } from '../../lib/ipc'
import { KindIcon, onLibraryChange, openChat, openEntry } from '../../lib/library'
import { formatRelative } from '../../lib/format'
import { useSessions } from '../../store/sessions'
import { cn } from '../../lib/cn'

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

export function NotificationButton() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const pending = usePending()
  const recent = useRecent(open)
  const sessions = useSessions((s) => s.list)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', key)
    }
  }, [open])

  const chatTitle = (id: string) => sessions.find((s) => s.id === id)?.title ?? 'a chat'
  const go = (fn: () => void) => {
    setOpen(false)
    fn()
  }

  return (
    <div ref={box} className="relative flex items-stretch">
      <button
        title={pending.length ? `${pending.length} waiting for you` : 'Notifications'}
        onClick={() => setOpen(!open)}
        className={cn('relative flex w-10 items-center justify-center transition-colors', open ? 'bg-accent/[0.07] text-accent' : pending.length ? 'text-accent hover:bg-white/[0.03]' : 'text-dim hover:bg-white/[0.03] hover:text-white')}
      >
        <Bell className="h-4 w-4" />
        {pending.length > 0 && (
          <span className="absolute right-1.5 top-2 flex h-3.5 min-w-3.5 items-center justify-center bg-accent px-0.5 font-mono text-[9px] font-bold text-black">{pending.length}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 bottom-full z-50 mb-2 flex max-h-[70vh] w-96 flex-col border border-line bg-bg/95 shadow-[0_0_24px_rgba(0,0,0,0.6)] backdrop-blur-sm">
          <div className="min-h-0 flex-1 overflow-y-auto pb-1.5">
            <Heading count={pending.length}>Waiting for you</Heading>
            {!pending.length ? (
              <div className="px-3 pb-1 text-[12px] text-faint">Nothing waiting.</div>
            ) : (
              pending.map((p) => (
                <button key={p.id} onClick={() => go(() => openChat(p.sessionId))} className="flex w-full items-start gap-2.5 border-l-2 border-l-accent px-3 py-1.5 text-left hover:bg-accent/[0.06]">
                  <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 text-accent [&>svg]:h-3.5 [&>svg]:w-3.5">{KIND_ICON[p.kind] ?? <HelpCircle />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] text-white">{p.label || p.tool || p.kind}</span>
                    <span className="block truncate text-[11px] text-dim">
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
                <button key={`${r.kind}/${r.id}/${r.at}`} onClick={() => go(() => openEntry(r.kind, r.id))} className="flex w-full items-center gap-2.5 px-3 py-1 text-left hover:bg-white/[0.04]">
                  <KindIcon name={r.icon} className="h-3.5 w-3.5 shrink-0 text-dim" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/85">{r.title}</span>
                  <span className="shrink-0 text-[11px] text-faint">
                    {r.what} · {formatRelative(r.at)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
